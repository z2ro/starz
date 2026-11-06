"""Authoritative shared transactions. One universe lock orders cross-empire effects.

shortcut: coarse universe serialization suits a local experiment; shard by ordered
empire/planet locks before scaling to a public population.
"""
from copy import deepcopy
from math import ceil
from time import time
from uuid import UUID, uuid4

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from ..data import DataValidationError
from ..db import models as m
from ..db.store import Store, load, persist, utc, epoch, _planet_summary, validate_state
from ..simulation import Engine
from ..universe import generate_system, colonization_viability
from ..progression import effect, level, research_quote, building_quote
from ..defenses import defense_quote
from .combat import resolve_battle, resolve_missiles, local_defenders
from .intelligence import gather_intelligence, intel_view, known_threat
from ..travel import preview_travel


def require(condition, message):
    if not condition:
        raise DataValidationError(message)


def locate(engine, ship):
    fleet = next((f for f in engine.state.fleets if ship['id'] in f['ship_ids']), None)
    return (fleet['x'], fleet['y']) if fleet else (ship['system_x'], ship['system_y'])


def busy(engine, ship):
    return ship['ready_at'] > engine.state.last_updated or any(ship['id'] in f['ship_ids'] and f['status'] == 'TRANSIT' for f in engine.state.fleets)


def power(engine, ships, defensive=False):
    c, s = engine.catalog, engine.state
    modifier = 1 + effect(c, s, 'weapons') + effect(c, s, 'armor') * .5 + effect(c, s, 'shields') * .5
    result = sum((c.get('ships', x['hull_id']).combat_power + c.get('ships', x['hull_id']).carrier_capacity * 5 * (1 + effect(c, s, 'carrier'))) * modifier for x in ships)
    if defensive:
        result += s.districts.get('orbital_battery', 0) * 12 * (1 + effect(c, s, 'defense') + effect(c, s, 'shields'))
    return result


class PersistentStore(Store):
    def __init__(self, database, catalog, seed='STARZ-PERSISTENT', clock=time):
        super().__init__(database, catalog, seed, clock)

    def lock(self, session):
        session.execute(text("SELECT pg_advisory_xact_lock(hashtextextended('starz-persistent-universe', 0))"))

    def universe(self, session):
        session.execute(insert(m.Universe).values(id=uuid4(), name='Persistent Universe', seed=self.seed, created_at=utc(self.clock())).on_conflict_do_nothing(index_elements=['name']))
        return session.scalar(select(m.Universe).where(m.Universe.name == 'Persistent Universe'))

    def create_player(self, session, username):
        self.lock(session)
        universe = self.universe(session)
        count = session.query(m.Empire).filter_by(universe_id=universe.id).count()
        occupied = {(s.x, s.y) for s in session.scalars(select(m.StarSystem).where(m.StarSystem.universe_id == universe.id))}
        chosen = None
        # Deterministic spiral allocation, real physically viable worlds only.
        for radius in range(0, 40):
            for x in range(-radius, radius + 1):
                for y in range(-radius, radius + 1):
                    if max(abs(x), abs(y)) != radius or (x, y) in occupied:
                        continue
                    system = generate_system(universe.seed, x, y, self.catalog)
                    if colonization_viability(system.planets[0], next(iter(self.catalog.items['colonization'].values()))) == 'VIABLE':
                        chosen = (x, y)
                        break
                if chosen: break
            if chosen: break
        require(chosen is not None and count < 1000, 'Universo local sem posições iniciais disponíveis.')
        now = self.clock()
        star = m.StarSystem(universe_id=universe.id, x=chosen[0], y=chosen[1], created_at=utc(now))
        session.add(star); session.flush()
        empire = m.Empire(universe_id=universe.id, home_system_id=star.id, name=username, created_at=utc(now), last_updated=utc(now))
        session.add(empire); session.flush()
        planet = m.Planet(system_id=star.id, planet_index=0, empire_id=empire.id, population_total=100, created_at=utc(now), last_updated=utc(now))
        session.add(planet); session.flush()
        empire.home_planet_id = planet.id
        e = Engine.new(self.catalog, universe.seed, now)
        s = e.state
        s.system_x, s.system_y = chosen
        s.planet_id = s.home_planet_id = str(planet.id)
        s.home_system_x, s.home_system_y = chosen
        s.planets = [_planet_summary(planet, star, True)]
        s.stocks = {'raw_ore': 500, 'volatiles': 300, 'refined_alloy': 400, 'components': 180, 'ion_fuel': 400, 'fusion_fuel': 100}
        s.districts = {'civil_district':2, 'solar_field':5, 'ore_extractor':1, 'research_lab':1, 'processor':1, 'volatile_well':1, 'fuel_refinery':1, 'orbital_shipyard':1}
        s.system_knowledge = {f'{chosen[0]}:{chosen[1]}':now}
        s.universe = {'levels': {'orbital_engineering':1}, 'reports': [], 'mode':'persistent'}
        s.research['completed'] = ['orbital_engineering']; s.research['completed_at'] = {'orbital_engineering':now}
        s.notices = ['Universo persistente: a produção, pesquisa e frotas continuam enquanto você está offline.']
        persist(session, empire, planet, s)
        return empire

    def engines(self, session, universe_id, stamp):
        result = {}
        for empire in session.scalars(select(m.Empire).join(m.EmpireProgress).where(m.Empire.universe_id == universe_id).order_by(m.Empire.id)):
            while True:
                e = Engine(self.catalog, load(session, empire, catalog=self.catalog))
                cursor = e.state.last_updated
                defense_payloads=session.scalars(select(m.PlanetDefenseState.payload).join(m.Planet).where(m.Planet.empire_id==empire.id)).all()
                boundaries = [j['complete_at'] for payload in defense_payloads for j in payload.get('queue',[])]
                boundaries += [epoch(t) for t in session.scalars(select(m.Construction.complete_at).join(m.Planet).where(m.Planet.empire_id == empire.id))]
                if e.state.research['complete_at'] is not None: boundaries.append(e.state.research['complete_at'])
                boundaries.extend(f['arrival_at'] for f in e.state.fleets if f['status'] == 'TRANSIT')
                boundary = min([max(stamp, cursor), *(t for t in boundaries if cursor < t <= stamp)])
                previous_levels = deepcopy(e.state.universe.get('levels', {}))
                e.advance(boundary)
                persist(session, empire, session.get(m.Planet, empire.home_planet_id), e.state)
                session.flush()
                for planet in list(e.state.planets):
                    if planet['id'] == str(empire.home_planet_id): continue
                    local = Engine(self.catalog, load(session, empire, planet_id=planet['id'], catalog=self.catalog))
                    current_levels = local.state.universe['levels']
                    # Research finishing at the boundary must not improve past colony production.
                    local.state.universe['levels'] = previous_levels
                    local.advance_planet(boundary)
                    local.state.universe['levels'] = current_levels
                    persist(session, empire, session.get(m.Planet, UUID(planet['id'])), local.state)
                    session.flush()
                if boundary >= stamp: break
            result[str(empire.id)] = Engine(self.catalog, load(session, empire, catalog=self.catalog))
        return result

    def settle(self, session, universe, stamp):
        # Resolve in timestamp order, so offline raids cannot steal future production.
        while True:
            order = session.scalar(select(m.UniverseOrder).where(m.UniverseOrder.universe_id == universe.id, m.UniverseOrder.resolved == False, m.UniverseOrder.due_at <= utc(stamp)).order_by(m.UniverseOrder.due_at, m.UniverseOrder.id).limit(1))
            if order is None: break
            engines = self.engines(session, universe.id, epoch(order.due_at))
            self.resolve(session, order, engines)
            order.resolved = True
            session.flush()
        self.engines(session, universe.id, stamp)

    def tick(self):
        with Session(self.database) as session, session.begin():
            self.lock(session)
            universe = self.universe(session)
            self.settle(session, universe, self.clock())

    def run(self, empire_id, call, now=None, *, planet_id=None, colony_target=None):
        with Session(self.database) as session, session.begin():
            self.lock(session)
            universe = self.universe(session)
            self.settle(session, universe, self.clock() if now is None else now)
            empire = session.get(m.Empire, empire_id)
            require(empire is not None and empire.universe_id == universe.id, 'Império não autorizado.')
            e = Engine(self.catalog, load(session, empire, planet_id=planet_id, catalog=self.catalog))
            result = call(e)
            validate_state(self.catalog, e.state)
            persist(session, empire, session.get(m.Planet, UUID(e.state.planet_id)), e.state)
            return result

    def transaction(self, empire_id, operation, planet_id=None):
        with Session(self.database) as session, session.begin():
            self.lock(session)
            universe = self.universe(session)
            self.settle(session, universe, self.clock())
            empire = session.get(m.Empire, empire_id)
            require(empire is not None and empire.universe_id == universe.id, 'Império não autorizado.')
            e = Engine(self.catalog, load(session, empire, planet_id=planet_id, catalog=self.catalog))
            result = operation(session, empire, e)
            validate_state(self.catalog, e.state)
            persist(session, empire, session.get(m.Planet, UUID(e.state.planet_id)), e.state)
            return result

    def save(self, session, empire_id, engine):
        persist(session, session.get(m.Empire, UUID(str(empire_id))), session.get(m.Planet, UUID(engine.state.planet_id)), engine.state)

    def report(self, e, message):
        reports = e.state.universe.setdefault('reports', [])
        reports.insert(0, {'at': e.state.last_updated, 'message': message})
        del reports[50:]
        e.state.notices.insert(0, message)

    def diplomacy(self, session, empire, e, target, intent):
        other = session.get(m.Empire, UUID(target))
        require(other and other.universe_id == empire.universe_id and other.id != empire.id, 'Alvo diplomático inválido.')
        rows = session.scalars(select(m.UniverseOrder).where(m.UniverseOrder.universe_id == empire.universe_id, m.UniverseOrder.kind == 'diplomacy')).all()
        key = sorted([str(empire.id),target])
        relation = next((r for r in rows if r.payload['parties'] == key), None)
        payload = deepcopy(relation.payload) if relation else {'parties':key, 'status':'neutral','proposal':None}
        if intent == 'war': payload.update(status='war', proposal=None)
        elif intent == 'propose': payload.update(proposal=str(empire.id),proposal_status='allied')
        elif intent == 'accept':
            require(payload['proposal'] == target, 'Não há proposta da outra parte.')
            payload.update(status=payload.get('proposal_status','allied'),proposal=None)
        elif intent == 'neutral': payload.update(proposal=str(empire.id),proposal_status='neutral')
        else: raise DataValidationError('Ação diplomática desconhecida.')
        if relation: relation.payload = payload
        else: session.add(m.UniverseOrder(universe_id=empire.universe_id, empire_id=empire.id,kind='diplomacy',payload=payload,resolved=True))
        self.report(e, f'Diplomacia com {other.name}: {payload["status"]}.')
        return payload

    def relation(self, session, a, b):
        key=sorted([str(a),str(b)])
        for r in session.scalars(select(m.UniverseOrder).where(m.UniverseOrder.kind=='diplomacy')):
            if r.payload['parties']==key: return r.payload
        return {'status':'neutral','proposal':None}

    def dispatch(self, session, empire, e, data):
        s=e.state; ids=data['ship_ids']; mission=data['mission']
        require(mission in {'MOVE','REINFORCE','SURVEY','COLONIZE','TRANSPORT','ATTACK','ESPIONAGE','RECON','EXPEDITION'},'Missão desconhecida.')
        require(0 < len(ids) <= 100 and len(ids)==len(set(ids)), 'Selecione de 1 a 100 naves únicas.')
        ships=[next((x for x in s.ships if x['id']==id),None) for id in ids]
        require(all(ships), 'Nave não pertence ao jogador.')
        require(all(not busy(e,x) for x in ships),'Nave em montagem ou trânsito.')
        origin=locate(e,ships[0]); require(all(locate(e,x)==origin for x in ships),'Naves precisam estar no mesmo sistema.')
        require(len({(x['propulsion_id'],x['fuel_id']) for x in ships})==1,'Agrupe naves com a mesma propulsão e combustível.')
        require(sum(f['status']=='TRANSIT' for f in s.fleets)<2+int(effect(e.catalog,s,'fleet_slots')),'Limite de frotas operacionais: pesquise Computação.')
        target = session.get(m.Planet, UUID(data['target_planet_id'])) if data.get('target_planet_id') else None
        tx,ty=data['x'],data['y']
        if target:
            star=session.get(m.StarSystem,target.system_id)
            require(star.universe_id==empire.universe_id,'Destino fora do universo.')
            tx,ty=star.x,star.y
        roles=[e.catalog.get('ships',x['hull_id']).role for x in ships]
        if mission in {'SURVEY','EXPEDITION','ESPIONAGE','RECON'}: require(any(r in {'exploration','science'} for r in roles),'Missão exige exploradora ou nave científica.')
        if mission=='RECON': require(target and target.empire_id and target.empire_id!=empire.id,'Reconhecimento exige planeta de outro jogador.')
        if mission=='REINFORCE': require(target and target.empire_id==empire.id,'Reforço exige um planeta do próprio império.')
        if mission=='ESPIONAGE': require(level(s,'intelligence')>=1 and target and target.empire_id and target.empire_id!=empire.id,'Espionagem exige Inteligência 1 e planeta de outro jogador.')
        if mission=='ATTACK': require(target and target.empire_id!=empire.id and self.relation(session,empire.id,target.empire_id)['status']=='war','Ataque exige guerra declarada contra o proprietário.')
        if mission=='TRANSPORT': require(target and target.empire_id is not None,'Transporte exige destino colonizado.')
        if mission=='EXPEDITION': require(level(s,'expedition_science')>=1,'Requer Ciência de expedições 1.')
        source=next((p for p in s.planets if (p['x'],p['y'])==origin and p['id']==s.planet_id),None)
        if source:
            require(all(ship['id'] in {v['id'] for v in local_defenders(e,source['id'])} for ship in ships),'Selecione o planeta onde estas naves estão destacadas.')
        if mission=='COLONIZE':
            require(source is not None,'Colonização deve partir do mundo próprio selecionado.')
            require(any(r in {'exploration','logistics'} for r in roles),'Colonização exige exploração ou logística.')
            require(data.get('planet_index') is not None,'Informe o índice planetário.')
            require(not target,'Colonização usa coordenadas e índice de planeta livre.')
            # The existing status helper requires one arrived fleet; selected vessels supply it.
            dummy={'status':'ARRIVED'};s.fleets.append(dummy)
            status=e.colonization_status(tx,ty,data['planet_index']);s.fleets.pop()
            require(status['eligible'],status['reason'])
        quotes=[preview_travel(e.catalog,origin,(tx,ty),x,x['propulsion_id'],'NORMAL',intra_system=True) for x in ships]
        speed=1+effect(e.catalog,s,'speed')
        duration=max(1,ceil(max(q['eta_seconds'] for q in quotes)/speed)) + (120 if mission=='EXPEDITION' else 0)
        fuel=ceil(sum(q['fuel_cost'] for q in quotes)/(1+effect(e.catalog,s,'fuel')+(effect(e.catalog,s,'transport') if mission=='TRANSPORT' else 0)))
        source=next((p for p in s.planets if (p['x'],p['y'])==origin and p['id']==s.planet_id),None)
        old=[f for f in s.fleets if set(ids)&set(f['ship_ids'])]
        capacity=sum(e.catalog.get('ships',x['hull_id']).cargo_capacity for x in ships)*(1+effect(e.catalog,s,'cargo'))
        if mission=='EXPEDITION': require(capacity>0, 'Expedição exige capacidade de carga; use uma Odyssey científica.')
        if data.get('preview'):
            return {'eta_seconds':duration,'fuel_id':ships[0]['fuel_id'],'fuel_cost':fuel,'launch_fuel':2*fuel if source or mission not in {'MOVE','REINFORCE','COLONIZE'} else fuel,'cargo_capacity':capacity,'ship_count':len(ships),'origin':list(origin),'destination':[tx,ty],'departure_at':s.last_updated,'arrival_at':s.last_updated+duration,'return_at':None if mission in {'MOVE','REINFORCE','COLONIZE'} else s.last_updated+2*duration,'threat':known_threat(s,str(target.id),s.last_updated) if target else {'status':'UNKNOWN','message':'Sem alvo planetário.'}}
        if mission=='COLONIZE':
            e._pay(e.colonization_rules.cost);s.population_total-=e.colonization_rules.population
        if source: e._pay({ships[0]['fuel_id']:2*fuel})
        else:
            require(all(set(f['ship_ids'])<=set(ids) for f in old),'Não divida frota remota sem abastecimento.')
            require(sum(f.get('fuel_reserve',0) for f in old)>=(fuel if mission in {'MOVE','REINFORCE','COLONIZE'} else 2*fuel),'Reserva insuficiente; reabasteça em mundo próprio.')
        cargo={}
        if mission=='TRANSPORT':
            require(source is not None,'Carregue em planeta próprio selecionado.')
            cargo=data.get('cargo') or {}; require(bool(cargo),'Carga vazia.')
            require(all(r in e.catalog.items['resources'] or r in e.catalog.items['fuels'] for r in cargo),'Recurso desconhecido.')
            capacity=sum(e.catalog.get('ships',x['hull_id']).cargo_capacity for x in ships)*(1+effect(e.catalog,s,'cargo'))
            require(sum(cargo.values())<=capacity,'Capacidade de carga insuficiente.')
            e._pay(cargo)
        reserve= fuel if source else sum(f.get('fuel_reserve',0) for f in old)-fuel
        for f in old: f['ship_ids']=[id for id in f['ship_ids'] if id not in ids]
        s.fleets=[f for f in s.fleets if f['ship_ids']]
        fid=str(uuid4());now=s.last_updated
        f={'id':fid,'name':f'{mission} · {len(ids)} naves','ship_ids':ids,'x':origin[0],'y':origin[1],'destination_x':tx,'destination_y':ty,'status':'TRANSIT','mission':'SURVEY' if mission=='SURVEY' else 'COLONIZE' if mission=='COLONIZE' else 'MOVE','target_planet_index':data.get('planet_index') if mission=='COLONIZE' else None,'colonization_population':e.colonization_rules.population if mission=='COLONIZE' else None,'colonization_origin_planet_id':s.planet_id if mission=='COLONIZE' else None,'origin_planet_id':source['id'] if source else next((f.get('origin_planet_id') for f in old if f.get('origin_planet_id')),None),'fuel_reserve':reserve,'departure_at':now,'arrival_at':now+duration,'propulsion':ships[0]['propulsion_id'],'mode':'NORMAL','fuel_cost':fuel}
        s.fleets.append(f)
        s.universe.setdefault('fleet_planets',{})[fid]=None
        session.add(m.UniverseOrder(universe_id=empire.universe_id,empire_id=empire.id,kind='mission',payload={'fleet_id':fid,'mission':mission,'target':str(target.id) if target else None,'cargo':cargo,'origin':list(origin),'origin_planet':source['id'] if source else next((f.get('origin_planet_id') for f in old if f.get('origin_planet_id')),None),'duration':duration,'fuel':fuel},due_at=utc(now+duration),resolved=False))
        return f

    def resolve(self, session, order, engines):
        e=engines.get(str(order.empire_id));p=order.payload
        if e is None:return
        if order.kind=='trade_delivery':
            for destination,cargo in p['deliveries']:
                planet=session.get(m.Planet,UUID(destination))
                local=Engine(self.catalog,load(session,session.get(m.Empire,planet.empire_id),planet_id=planet.id,catalog=self.catalog))
                for resource,amount in cargo.items():local.state.stocks[resource]=local.state.stocks.get(resource,0)+amount
                self.report(local, f'Contrato comercial entregue: {cargo}. Taxa logística já descontada.')
                self.save(session,planet.empire_id,local);session.flush()
                engines[str(planet.empire_id)]=Engine(self.catalog,load(session,session.get(m.Empire,planet.empire_id),catalog=self.catalog))
            return
        if order.kind=='strategic_missile':
            target=session.get(m.Planet,UUID(p['target']))
            if target and target.empire_id and self.relation(session,order.empire_id,target.empire_id)['status']=='war':
                local=Engine(self.catalog,load(session,session.get(m.Empire,target.empire_id),planet_id=target.id,catalog=self.catalog))
                battle=resolve_missiles(e,local,p['count'],p.get('target_type'))
                battle.update(attacker_name=session.get(m.Empire,order.empire_id).name,defender_name=session.get(m.Empire,target.empire_id).name,attacker=str(order.empire_id),defender=str(target.empire_id),planet_name=local.system().planet.name,coordinates=[local.state.system_x,local.state.system_y,local.state.planet_index])
                self.battle_report(e,battle);self.battle_report(local,battle)
                self.save(session,target.empire_id,local);session.flush()
                engines[str(target.empire_id)]=Engine(self.catalog,load(session,session.get(m.Empire,target.empire_id),catalog=self.catalog))
            else:self.report(e,'Mísseis autodestruídos: destino sem guerra ativa. Munição lançada não é devolvida.')
            self.save(session,order.empire_id,e);return
        if order.kind!='mission':return
        fleet=next((f for f in e.state.fleets if f['id']==p['fleet_id']),None)
        if not fleet:return
        mission=p['mission'];ships=[s for s in e.state.ships if s['id'] in fleet['ship_ids']]
        target=session.get(m.Planet,UUID(p['target'])) if p.get('target') else None
        target_engine=None
        if target:
            target_engine=Engine(self.catalog,load(session,session.get(m.Empire,target.empire_id),planet_id=target.id,catalog=self.catalog))
        if mission in {'MOVE','REINFORCE'}:e.state.universe.setdefault('fleet_planets',{})[fleet['id']]=str(target.id) if target and target.empire_id==order.empire_id else None
        if mission=='RETURN':e.state.universe.setdefault('fleet_planets',{})[fleet['id']]=p.get('origin_planet')
        if mission=='TRANSPORT' and target:
            for r,n in p['cargo'].items():target_engine.state.stocks[r]=target_engine.state.stocks.get(r,0)+n
            self.report(target_engine, f'Carga recebida: {p["cargo"]}.')
        elif mission in {'ESPIONAGE','RECON'} and target:
            intelligence=gather_intelligence(e,target_engine,ships,mission)
            self.report(e,f"Inteligência de {intelligence['planet_name']}: qualidade {intelligence['quality']}/3. Consulte Registros.")
            if intelligence['detected']:self.report(target_engine,f"Reconhecimento de {session.get(m.Empire,order.empire_id).name} detectado em {intelligence['planet_name']}. Reveja suas defesas.")
        elif mission=='ATTACK' and target:
            # A peace accepted during transit prevents combat; vessels return intact.
            if self.relation(session,order.empire_id,target.empire_id)['status']=='war':
                battle=resolve_battle(e,ships,target_engine,str(target.id))
                battle.update(attacker_name=session.get(m.Empire,order.empire_id).name,defender_name=session.get(m.Empire,target.empire_id).name,attacker=str(order.empire_id),defender=str(target.empire_id),planet_name=target_engine.system().planet.name,coordinates=[target_engine.state.system_x,target_engine.state.system_y,target_engine.state.planet_index])
                self.battle_report(e,battle);self.battle_report(target_engine,battle)
                p=deepcopy(p);p['cargo']=battle['loot']
        elif mission=='EXPEDITION':
            reward=ceil(20*(1+effect(self.catalog,e.state,'expedition'))*(1+sum(self.catalog.get('ships',s['hull_id']).science_bonus for s in ships)))
            capacity=sum(self.catalog.get('ships',s['hull_id']).cargo_capacity for s in ships)*(1+effect(self.catalog,e.state,'cargo'))
            reward=min(reward,capacity/1.5)
            p=deepcopy(p);p['cargo']={'raw_ore':reward,'volatiles':reward/2}
            self.report(e,'Expedição coletou amostras; entrega no retorno.')
        elif mission=='RETURN':
            destination=next((world for world in e.state.planets if world['id']==p['origin_planet']),None) if p.get('origin_planet') else next((world for world in e.state.planets if [world['x'],world['y']]==p['origin']),None)
            if destination:
                stocks=e.state.stocks_by_planet[destination['id']]
                for r,n in p.get('cargo',{}).items():stocks[r]=stocks.get(r,0)+n
                if destination['id']==e.state.planet_id:e.state.stocks=stocks
            self.report(e,'Frota retornou ao sistema de origem.')
        if target_engine:
            self.save(session,target.empire_id,target_engine);session.flush()
            # Same-owner delivery must not be overwritten by the origin snapshot.
            if target.empire_id==order.empire_id:
                for r,n in p['cargo'].items():
                    e.state.stocks_by_planet[str(target.id)][r]=target_engine.state.stocks[r]
        if mission not in {'MOVE','REINFORCE','COLONIZE','RETURN'} and fleet in e.state.fleets:
            fleet.update(status='TRANSIT',mission='MOVE',destination_x=p['origin'][0],destination_y=p['origin'][1],departure_at=e.state.last_updated,arrival_at=e.state.last_updated+p['duration'],fuel_reserve=max(0,fleet.get('fuel_reserve',0)-p['fuel']))
            session.add(m.UniverseOrder(universe_id=order.universe_id,empire_id=order.empire_id,kind='mission',payload={**p,'mission':'RETURN','cargo':p.get('cargo',{}) if mission in {'ATTACK','EXPEDITION'} else {}},due_at=utc(fleet['arrival_at']),resolved=False))
        self.save(session,order.empire_id,e)

    def recall(self,session,empire,e,fleet_id):
        fleet=next((f for f in e.state.fleets if f['id']==fleet_id),None)
        require(fleet is not None,'Frota não pertence ao jogador.')
        order=next((o for o in session.scalars(select(m.UniverseOrder).where(m.UniverseOrder.empire_id==empire.id,m.UniverseOrder.kind=='mission',m.UniverseOrder.resolved==False)) if o.payload['fleet_id']==fleet_id),None)
        if order:
            require(order.payload['mission'] not in {'RETURN','COLONIZE'},'Retorno ou colonização já comprometidos; recall indisponível.')
            p=deepcopy(order.payload);duration=max(1,ceil(e.state.last_updated-fleet['departure_at']))
            require(fleet.get('fuel_reserve',0)>=p['fuel'],'Sem reserva de retorno.')
            order.resolved=True
        else:
            require(fleet['status']=='ARRIVED','Frota sem ordem retornável.')
            destination=next((p for p in e.state.planets if p['id']==fleet.get('origin_planet_id')),None)
            require(destination is not None,'Origem não disponível para retorno.')
            ships=[s for s in e.state.ships if s['id'] in fleet['ship_ids']]
            quotes=[preview_travel(self.catalog,(fleet['x'],fleet['y']),(destination['x'],destination['y']),s,s['propulsion_id'],'NORMAL',intra_system=True) for s in ships]
            require(bool(quotes),'Frota sem naves operacionais.')
            duration=max(1,ceil(max(q['eta_seconds'] for q in quotes)/(1+effect(self.catalog,e.state,'speed'))))
            p={'fleet_id':fleet_id,'origin':[destination['x'],destination['y']],'origin_planet':destination['id'],'cargo':{},'target':None,'fuel':ceil(sum(q['fuel_cost'] for q in quotes)/(1+effect(self.catalog,e.state,'fuel')))}
            require(fleet.get('fuel_reserve',0)>=p['fuel'],'Sem reserva de retorno.')
        p.update(mission='RETURN',target=None,duration=duration)
        fleet.update(status='TRANSIT',mission='MOVE',destination_x=p['origin'][0],destination_y=p['origin'][1],departure_at=e.state.last_updated,arrival_at=e.state.last_updated+duration,fuel_reserve=max(0,fleet.get('fuel_reserve',0)-p['fuel']))
        e.state.universe.setdefault('fleet_planets',{})[fleet_id]=None
        session.add(m.UniverseOrder(universe_id=empire.universe_id,empire_id=empire.id,kind='mission',payload=p,due_at=utc(fleet['arrival_at']),resolved=False))
        self.report(e,'Retorno ordenado; carga não entregue volta à origem. Combate de destino cancelado.')
        return {'arrival_at':fleet['arrival_at']}

    def market(self, session, empire, e, data):
        if data['action']=='offer':
            require(data['give']!=data['want'],'Recursos precisam ser diferentes.')
            for r in (data['give'],data['want']):require(r in self.catalog.items['resources'] or r in self.catalog.items['fuels'],'Recurso inválido.')
            e._pay({data['give']:data['give_amount']})
            row=m.UniverseOrder(universe_id=empire.universe_id,empire_id=empire.id,kind='market',payload={**data,'planet_id':e.state.planet_id,'name':empire.name,'status':'open'},resolved=False)
            session.add(row);session.flush();return {'id':str(row.id)}
        row=session.get(m.UniverseOrder,UUID(data['order_id']))
        require(row and row.universe_id==empire.universe_id and row.kind=='market' and row.payload['status']=='open','Oferta indisponível.')
        p=deepcopy(row.payload)
        if data['action']=='cancel':
            require(row.empire_id==empire.id,'A oferta não pertence ao jogador.')
            require(p['planet_id']==e.state.planet_id,'Selecione o mundo que criou a oferta.')
            e.state.stocks[p['give']]=e.state.stocks.get(p['give'],0)+p['give_amount'];p['status']='cancelled'
        else:
            require(row.empire_id!=empire.id,'Não aceite a própria oferta.')
            require(level(e.state,'logistics')>=1,'Contrato de transporte exige Logística 1.')
            e._pay({p['want']:p['want_amount']})
            # Contract courier: explicit 10% resource fee, not a fictional player ship.
            source=session.get(m.Planet,UUID(p['planet_id']));star=session.get(m.StarSystem,source.system_id)
            distance=((star.x-e.state.system_x)**2+(star.y-e.state.system_y)**2)**.5
            due=e.state.last_updated+max(30,ceil(distance*180))
            deliveries=[[e.state.planet_id,{p['give']:p['give_amount']*.9}],[p['planet_id'],{p['want']:p['want_amount']*.9}]]
            session.add(m.UniverseOrder(universe_id=empire.universe_id,empire_id=empire.id,kind='trade_delivery',payload={'deliveries':deliveries},due_at=utc(due),resolved=False));p['status']='matched'
        row.payload=p;row.resolved=True
        return {'status':p['status']}

    def overview(self, session, empire, e):
        players=[]
        for other in session.scalars(select(m.Empire).join(m.EmpireProgress).where(m.Empire.universe_id==empire.universe_id)):
            planets=[]
            for planet,star in session.execute(select(m.Planet,m.StarSystem).join(m.StarSystem).where(m.Planet.empire_id==other.id)):
                planets.append({'id':str(planet.id),'x':star.x,'y':star.y,'index':planet.planet_index,'home':planet.id==other.home_planet_id})
            players.append({'id':str(other.id),'name':other.name,'self':other.id==empire.id,'planets':planets,'relation':self.relation(session,empire.id,other.id)})
        orders=session.scalars(select(m.UniverseOrder).where(m.UniverseOrder.universe_id==empire.universe_id)).all()
        return {'empire_id':str(empire.id),'name':empire.name,'players':players,'defenses':self.defense_details(session,empire,e),'battles':e.state.universe.get('battles',[]),'intelligence':intel_view(e.state,e.state.last_updated),'research':[research_quote(self.catalog,e.state,t) for t in self.catalog.items['technologies']], 'buildings':[building_quote(self.catalog,e.state,t) for t in self.catalog.items['districts'] if e.state.districts.get(t,0)<50], 'reports':e.state.universe.get('reports',[]),'fleet_limit':2+int(effect(self.catalog,e.state,'fleet_slots')),'colony_limit':1+int(effect(self.catalog,e.state,'colonies')),'market':[{'id':str(o.id),'owner':str(o.empire_id),**o.payload} for o in orders if o.kind=='market' and o.payload['status']=='open'], 'missions':[{'id':str(o.id),'due_at':epoch(o.due_at),**o.payload} for o in orders if o.kind=='mission' and o.empire_id==empire.id and not o.resolved]}


    def battle_report(self,engine,battle):
        engine.state.universe['battles']=[battle,*engine.state.universe.get('battles',[])][:30]
        outcome={'attacker':'vitória do atacante','defender':'vitória do defensor','draw':'sem vencedor','resolved':'salva resolvida'}.get(battle['outcome'],battle['outcome'])
        self.report(engine,f"Batalha em {battle.get('planet_name','planeta alvo')}: {outcome}. Consulte o relatório detalhado.")

    def defense_details(self,session,empire,e):
        return {'ships':[{'id':s['id'],'hull_id':s['hull_id'],'hp':e.state.universe.get('ship_health',{}).get(s['id'],self.catalog.get('ships',s['hull_id']).hull_points)} for s in local_defenders(e,e.state.planet_id)],'inventory':e.state.defenses,'options':[defense_quote(e,d.id) for d in self.catalog.items['defenses'].values()], 'repairs':[{**defense_quote(e,u['type'],repair=u['id']),'unit_id':u['id']} for u in e.state.defenses['units'] if u['hp']<self.catalog.get('defenses',u['type']).hull_points], 'operational':min(e.capacities()['energy_coverage'],e.capacities()['workforce_coverage']), 'battles':[b for b in e.state.universe.get('battles',[]) if b['planet_id']==e.state.planet_id], 'strikes':[{'id':str(o.id),'due_at':epoch(o.due_at),**o.payload} for o in session.scalars(select(m.UniverseOrder).where(m.UniverseOrder.universe_id==empire.universe_id,m.UniverseOrder.kind=='strategic_missile',m.UniverseOrder.resolved==False)) if o.payload['target']==e.state.planet_id or o.payload['origin_planet']==e.state.planet_id]}

    def launch_missiles(self,session,empire,e,target_id,count,target_type=None):
        target=session.get(m.Planet,UUID(target_id))
        require(target is not None and target.empire_id is not None and target.empire_id!=empire.id,'Destino precisa pertencer a outro império.')
        star=session.get(m.StarSystem,target.system_id)
        require(star.universe_id==empire.universe_id,'Destino fora do universo.')
        require(self.relation(session,empire.id,target.empire_id)['status']=='war','Lançamento exige guerra declarada.')
        if target_type:require(self.catalog.get('defenses',target_type).kind=='structure','Alvo defensivo inválido.')
        require(any(u['type']=='orbital_missile_battery' for u in e.state.defenses['units']),'Construa uma bateria orbital de mísseis.')
        cap=e.capacities();require(min(cap['energy_coverage'],cap['workforce_coverage'])>=.5,'Bateria exige ao menos 50% de energia e trabalhadores.')
        distance=((star.x-e.state.system_x)**2+(star.y-e.state.system_y)**2)**.5
        require(distance<=max(self.catalog.get('defenses',u['type']).missile_range for u in e.state.defenses['units'] if u['type']=='orbital_missile_battery')*(1+effect(self.catalog,e.state,'sensors')),'Destino fora do alcance dos sensores e mísseis.')
        require(1<=count<=50 and e.state.defenses['ammunition'].get('strategic_missile',0)>=count,'Mísseis estratégicos insuficientes (salva de 1 a 50).')
        e.state.defenses['ammunition']['strategic_missile']-=count
        arrival=e.state.last_updated+max(30,ceil(distance*45/(1+effect(self.catalog,e.state,'speed'))))
        row=m.UniverseOrder(universe_id=empire.universe_id,empire_id=empire.id,kind='strategic_missile',payload={'target':str(target.id),'origin_planet':e.state.planet_id,'count':count,'target_type':target_type},due_at=utc(arrival),resolved=False)
        session.add(row);session.flush();return {'id':str(row.id),'arrival_at':arrival,'count':count}
