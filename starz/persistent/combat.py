"""Deterministic, simultaneous salvos over actual persistent units (six rounds)."""
from copy import deepcopy
from ..progression import effect, level
from .combat_rules import combat_config, ew_contest, experiment_rules


def local_defenders(engine,planet_id):
    s=engine.state;result=[];locations=s.universe.get('fleet_planets',{})
    for ship in s.ships:
        if ship['ready_at']>s.last_updated:continue
        fleet=next((f for f in s.fleets if ship['id'] in f['ship_ids']),None)
        if fleet and fleet['status']!='ARRIVED':continue
        if fleet and fleet['id'] in locations:
            present=locations[fleet['id']]==planet_id
        else:
            # Legacy fleets at their known origin inherit that planet, never every world in a system.
            position=(fleet['x'],fleet['y']) if fleet else (ship.get('system_x'),ship.get('system_y'))
            present=ship.get('origin_planet_id')==planet_id and position==(ship.get('system_x'),ship.get('system_y'))
        if present:result.append(ship)
    return result


def fleet_units(engine,ships):
    c,s=engine.catalog,engine.state;health=s.universe.get('ship_health',{});units=[]
    for ship in sorted(ships,key=lambda x:x['id']):
        h=c.get('ships',ship['hull_id'])
        units.append({'id':ship['id'],'type':h.id,'kind':'ship','class':h.combat_class,'hp':min(h.hull_points,health.get(ship['id'],h.hull_points)),'shield':h.shield_points*(1+effect(c,s,'shields')),'damage':(h.weapon_damage+h.carrier_capacity*5*(1+effect(c,s,'carrier')))*(1+effect(c,s,'weapons')),'modifiers':h.weapon_modifiers,'armor':1+effect(c,s,'armor')})
    return units


def defense_units(engine, *, respect_modes=True):
    c,s=engine.catalog,engine.state;cap=engine.capacities();factor=min(cap['energy_coverage'],cap['workforce_coverage'])
    units=[]
    for unit in sorted(s.defenses['units'],key=lambda u:u['id']):
        d=c.get('defenses',unit['type'])
        units.append({'id':unit['id'],'type':d.id,'kind':'defense','class':'capital' if d.hull_points>=300 else 'medium','hp':unit['hp'],'shield':0,'damage':d.damage*(1+effect(c,s,'weapons'))*(1+effect(c,s,'defense'))*factor,'modifiers':d.modifiers,'armor':1+effect(c,s,'armor'),'ammunition':d.ammunition,'charge_initial':unit.get('charge',0),'pool_initial':min(unit.get('charge',0),d.shield*(1+effect(c,s,'shields')))*factor,'pool':min(unit.get('charge',0),d.shield*(1+effect(c,s,'shields')))*factor})
        if respect_modes and d.id=='orbital_platform' and unit.get('mode')=='interdiction':
            units[-1]['damage']=0
    return units


ESCORTS = {
    'vanguard_hull': ('scout_hull', 'wayfarer_hull', 'odyssey_hull'),
    'sentinel_hull': ('scout_hull', 'wayfarer_hull', 'odyssey_hull', 'atlas_hull'),
    'aegis_hull': ('atlas_hull', 'dominion_hull'),
}


def plans(shooters,targets,ammo, *, doctrine='balanced', escorts=False, profile=(1,1), telemetry=None):
    result=[];projected={t['id']:t['hp']+t['shield'] for t in targets};pool_left=sum(t.get('pool',0) for t in targets)
    enhanced=doctrine!='balanced' or escorts or profile!=(1,1)
    projection={t['id']:t for t in deepcopy(targets)} if enhanced else {}
    used=set()
    for source in shooters:
        eligible=[t for t in targets if (projection[t['id']]['hp'] if enhanced else projected[t['id']])>0]
        if source['damage']<=0 or not eligible:continue
        ammunition=source.get('ammunition')
        if ammunition:
            if ammo.get(ammunition,0)<1:continue
            ammo[ammunition]-=1
        preferred=[]
        if doctrine=='interception':preferred=[t for t in eligible if t['class']=='light']
        elif doctrine=='rupture':
            preferred=next(([t for t in eligible if t['class']==cls] for cls in ('capital','medium','light') if any(t['class']==cls for t in eligible)),[])
        target=max(preferred or eligible,key=lambda t:(source['modifiers'].get(t['class'],1),-t['hp'],t['id']))
        intended=target
        if escorts and target['kind']=='ship':
            covering=[t for t in eligible if t['kind']=='ship' and t['id']!=target['id'] and t['id'] not in used
                      and target['type'] in ESCORTS.get(t['type'],())
                      and (t['type']!='sentinel_hull' or source['kind']=='ship' and source['class']=='light')]
            if covering:
                # Experimental deterministic specialty order, then stable ID.
                target=min(covering,key=lambda t:(('sentinel_hull','vanguard_hull','aegis_hull').index(t['type']),t['id']))
                used.add(target['id'])
        damage=source['damage']*source['modifiers'].get(target['class'],1)
        result.append((target,damage))
        if telemetry is not None:
            telemetry.append({'source_id':source['id'],'intended_target_id':intended['id'],
                              'effective_target_id':target['id'],'redirected':target is not intended})
        if enhanced:
            apply_hits([(projection[target['id']],damage)],list(projection.values()),
                       [t for t in projection.values() if t.get('pool',0)>0],profile=profile)
        else:
            absorbed=min(pool_left,damage);pool_left-=absorbed;projected[target['id']]-=(damage-absorbed)/target['armor']
    return result


def apply_hits(hits,targets,pool, *, profile=(1,1)):
    result={'shots':len(hits),'damage':0,'shield_absorbed':0,'hull_damage':0,'losses':{}}
    for target,damage in hits:
        result['damage']+=damage
        for generator in pool:
            absorbed=min(generator.get('pool',0),damage*profile[0]);generator['pool']-=absorbed;damage=max(0,damage-absorbed/profile[0]);result['shield_absorbed']+=absorbed
            if damage<=0:break
        absorbed=min(target['shield'],damage*profile[0]);target['shield']-=absorbed;damage=max(0,damage-absorbed/profile[0]);result['shield_absorbed']+=absorbed
        dealt=min(target['hp'],damage*profile[1]/target['armor']);target['hp']-=dealt;result['hull_damage']+=dealt
    for unit in targets:
        if unit['hp']<=0:result['losses'][unit['type']]=result['losses'].get(unit['type'],0)+1
    return result


def resolve_battle(attacker,ships,defender,planet_id, *, config=None):
    config=combat_config(config)
    doctrine=config['doctrine'] if level(attacker.state,'fire_control_doctrine')>0 else 'balanced'
    weapon_profile=config['weapon_profile'] if level(attacker.state,'shield_disruption')>0 else 'standard'
    rules=experiment_rules(config['experiment']);profile=(rules['shield'],rules['hull']) if weapon_profile=='anti_shield' else (1,1)
    a=[u for u in fleet_units(attacker,ships) if u['hp']>0]
    d=[u for u in fleet_units(defender,local_defenders(defender,planet_id))+defense_units(defender) if u['hp']>0]
    ammo=deepcopy(defender.state.defenses['ammunition']);ammo_before=deepcopy(ammo);before=deepcopy(d);attacking_before=deepcopy(a);rounds=[]
    for turn in range(1,7):
        if not a or not d:break
        degraded=ew_contest(defender,d,attacker,config['experiment'])
        effective='balanced' if degraded else doctrine
        atelemetry=[];dtelemetry=[]
        ahits=plans(a,d,{},doctrine=effective,escorts=level(defender.state,'fleet_coordination')>0,profile=profile,telemetry=atelemetry)
        dhits=plans(d,a,ammo,escorts=level(attacker.state,'fleet_coordination')>0,telemetry=dtelemetry)
        received_d=apply_hits(ahits,d,[u for u in d if u.get('pool',0)>0],profile=profile);received_a=apply_hits(dhits,a,[])
        rounds.append({'round':turn,'attacker':received_a,'defender':received_d,
                       'targeting':{'attacker':{'doctrine':effective,'shots':atelemetry},
                                    'defender':{'doctrine':'balanced','shots':dtelemetry}}})
        a=[u for u in a if u['hp']>0];d=[u for u in d if u['hp']>0]
    for engine,units in ((attacker,a),(defender,d)):
        engine.state.universe.setdefault('ship_health',{}).update({u['id']:u['hp'] for u in units if u['kind']=='ship'})
    lost_a={s['id'] for s in ships}-{u['id'] for u in a}
    lost_d={s['id'] for s in local_defenders(defender,planet_id)}-{u['id'] for u in d if u['kind']=='ship'}
    for engine,lost in ((attacker,lost_a),(defender,lost_d)):
        engine.state.ships=[s for s in engine.state.ships if s['id'] not in lost]
        for f in engine.state.fleets:f['ship_ids']=[id for id in f['ship_ids'] if id not in lost]
        engine.state.fleets=[f for f in engine.state.fleets if f['ship_ids']]
        for id in lost:engine.state.universe.setdefault('ship_health',{}).pop(id,None)
    surviving={u['id']:u for u in d if u['kind']=='defense'}
    defender.state.defenses['units']=[{**u,'hp':surviving[u['id']]['hp'],'charge':max(0,surviving[u['id']].get('charge_initial',0)-surviving[u['id']].get('pool_initial',0)+surviving[u['id']].get('pool',0))} for u in defender.state.defenses['units'] if u['id'] in surviving]
    defender.state.defenses['ammunition']=ammo
    won=bool(a) and not d;loot={}
    if won:
        capacity=sum(attacker.catalog.get('ships',s['hull_id']).cargo_capacity for s in attacker.state.ships if s['id'] in {u['id'] for u in a})*(1+effect(attacker.catalog,attacker.state,'cargo'))
        for r,n in sorted(defender.state.stocks.items()):
            take=min(n*.25,capacity);defender.state.stocks[r]-=take;capacity-=take
            if take:loot[r]=take
    return {'combat_config':{**config,'doctrine':doctrine,'weapon_profile':weapon_profile},'kind':'fleet','planet_id':planet_id,'at':attacker.state.last_updated,'attacking_fleet_before':attacking_before,'defending_fleet_before':[u for u in before if u['kind']=='ship'],'attacking_fleet_after':a,'defending_fleet_after':[u for u in d if u['kind']=='ship'],'outcome':'attacker' if won else 'defender' if not a and d else 'draw','rounds':rounds,'attacker_losses':sorted(lost_a),'defender_losses':sorted(lost_d),'defenses_before':[{k:u[k] for k in ('id','type','hp')} for u in before if u['kind']=='defense'],'defenses_after':deepcopy(defender.state.defenses['units']),'ammunition_before':ammo_before,'ammunition_consumed':{k:v-ammo.get(k,0) for k,v in ammo_before.items()},'ammunition_after':ammo,'technology':{'attacker':technology_snapshot(attacker,combat_effect_keys(attacker,attacking_before)),'defender':technology_snapshot(defender,combat_effect_keys(defender,before))},'economic_losses':{'attacker':loss_cost(attacker,attacking_before,a),'defender':loss_cost(defender,before,d)},'loot':loot}


def resolve_missiles(attacker,defender,count,target_type=None):
    c,s=defender.catalog,defender.state;cap=defender.capacities();factor=min(cap['energy_coverage'],cap['workforce_coverage'])
    interceptors=sum(c.get('defenses',u['type']).intercept_capacity for u in s.defenses['units']);ammo=s.defenses['ammunition'];intercepted=min(count,ammo.get('interceptor_missile',0),int(interceptors*factor));ammo['interceptor_missile']=ammo.get('interceptor_missile',0)-intercepted
    ammo_before=deepcopy(ammo);ammo_before['interceptor_missile']=ammo.get('interceptor_missile',0)+intercepted
    # Missile target ranking retains conventional damage regardless of platform mode.
    units=defense_units(defender,respect_modes=False);before=deepcopy(s.defenses['units']);shield=damage=0;infrastructure=0
    for _ in range(count-intercepted):
        alive=[u for u in units if u['hp']>0];power=c.get('defenses','strategic_missile').damage*(1+effect(attacker.catalog,attacker.state,'weapons'))
        for generator in [u for u in alive if u.get('pool',0)>0]:
            absorbed=min(generator['pool'],power);generator['pool']-=absorbed;power-=absorbed;shield+=absorbed
        candidates=[u for u in alive if u['type']==target_type] or alive
        if candidates:
            target=max(candidates,key=lambda u:(u['damage'],u['id']));dealt=min(target['hp'],power/target['armor']);target['hp']-=dealt;damage+=dealt
        else:infrastructure+=power/(1+effect(c,s,'armor'))
    surviving={u['id']:u for u in units if u['hp']>0}
    s.defenses['units']=[{**u,'hp':surviving[u['id']]['hp'],'charge':max(0,surviving[u['id']].get('charge_initial',0)-surviving[u['id']].get('pool_initial',0)+surviving[u['id']].get('pool',0))} for u in s.defenses['units'] if u['id'] in surviving]
    lost_buildings={}
    for id in sorted(s.districts):
        if id=='civil_district':continue
        while infrastructure>=200 and s.districts[id]>0:
            s.districts[id]-=1;infrastructure-=200;lost_buildings[id]=lost_buildings.get(id,0)+1
    return {'kind':'missile','planet_id':s.planet_id,'at':s.last_updated,'incoming':count,'intercepted':intercepted,'shield_absorbed':shield,'hull_damage':damage,'defenses_before':before,'defenses_after':deepcopy(s.defenses['units']),'infrastructure_losses':lost_buildings,'ammunition_before':ammo_before,'ammunition_consumed':{'interceptor_missile':intercepted},'technology':{'attacker':technology_snapshot(attacker,{'weapons'}),'defender':technology_snapshot(defender,{'armor','shields'})},'ammunition_after':deepcopy(ammo),'outcome':'resolved','loot':{}}


def combat_effect_keys(engine,units):
    keys={'armor'} if units else set()
    if any(u['damage']>0 for u in units):keys.add('weapons')
    if any(u.get('shield',0)>0 or u.get('pool_initial',0)>0 for u in units):keys.add('shields')
    if any(u['kind']=='defense' and u['damage']>0 for u in units):keys.add('defense')
    if any(u['kind']=='ship' and engine.catalog.get('ships',u['type']).carrier_capacity for u in units):keys.add('carrier')
    return keys


def technology_snapshot(engine,keys):
    from ..progression import level,technology_effects
    result={}
    for tech in engine.catalog.items['technologies'].values():
        value=level(engine.state,tech.id)
        bonuses={key:n for key,n in technology_effects(tech,value).items() if key in keys and n}
        if bonuses:result[tech.id]={'level':value,'bonus':sum(bonuses.values()),'effects':bonuses}
    return result


def loss_cost(engine,before,after):
    survivors={u['id'] for u in after};cost={}
    for unit in before:
        if unit['id'] in survivors:continue
        item=engine.catalog.get('ships' if unit['kind']=='ship' else 'defenses',unit['type'])
        for r,n in item.cost.items():cost[r]=cost.get(r,0)+n
    return cost
