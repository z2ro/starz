"""Concordat campaign rules. No ORM, HTTP, wall clock or rendering dependencies."""
from copy import deepcopy
import math
from .data import DataValidationError
from .universe import generate_system, colonization_viability

TURN_SECONDS = 300
DEADLINE = 60
EVENTS = {
    6: {'id': 'relic', 'title': 'Um arquivo entre as estrelas', 'text': 'Um arquivo anterior ao colapso foi encontrado. Preservá-lo amplia a ciência; desmontá-lo acelera a indústria.', 'choices': ['preserve', 'salvage']},
    12: {'id': 'refugees', 'title': 'Refugiados no limite do setor', 'text': 'Vinte pessoas pedem abrigo. Acolher custa 10 voláteis; fechar a fronteira preserva os estoques.', 'choices': ['welcome', 'close']},
    20: {'id': 'flare', 'title': 'Frente de radiação', 'text': 'Reforçar a infraestrutura custa 40 ligas. Aceitar o risco causa 12 de dano ao homeworld.', 'choices': ['harden', 'risk']},
    32: {'id': 'embargo', 'title': 'Uma última concessão', 'text': 'Fornecedores pedem 30 componentes. Negar acelera o armamento dos rivais ainda hostis.', 'choices': ['pay', 'refuse']},
}


def require(condition, message):
    if not condition:
        raise DataValidationError(message)


def log(c, message):
    c['log'].insert(0, {'turn': c['turn'], 'message': message})
    del c['log'][60:]


def initialize(e):
    require(e.state.campaign is None, 'campanha já iniciada')
    hx, hy = e.state.system_x, e.state.system_y
    rivals = [dict(id='helion', name='Liga Helion', x=hx + 1, y=hy, relation=10, contacted=False, allied=False, conquered=False, strength=14., treasury=10., industry=2, worlds=1, claims=[[hx + 1, hy]], last_action='Observando as fronteiras'), dict(id='obsidian', name='Pacto Obsidian', x=hx, y=hy + 1, relation=-10, contacted=False, allied=False, conquered=False, strength=22., treasury=15., industry=3, worlds=1, claims=[[hx, hy + 1]], last_action='Fortificando a capital')]
    targets, seen = [], {(hx, hy), *((r['x'], r['y']) for r in rivals)}
    for radius in range(1, 3):
        for dx in range(-radius, radius + 1):
            for dy in range(-radius, radius + 1):
                x, y = hx + dx, hy + dy
                if max(abs(dx), abs(dy)) != radius or (x, y) in seen or abs(x) > 100 or abs(y) > 100:
                    continue
                world = generate_system(e.state.seed, x, y, e.catalog)
                viable = next((i for i, p in enumerate(world.planets) if colonization_viability(p, e.colonization_rules) == 'VIABLE'), None)
                if viable is not None:
                    targets.append({'x': x, 'y': y, 'planet_index': viable}); seen.add((x, y))
                if len(targets) == 3:
                    break
            if len(targets) == 3:
                break
        if len(targets) == 3:
            break
    require(len(targets) >= 2, 'Esta seed não oferece dois alvos coloniais próximos; escolha outra seed.')
    e.state.campaign = dict(version=1, turn=0, orders=4, phase='PLAYING', integrity=100, discoveries=0, reports=[], deliveries=0, health={}, jobs=[], rivals=rivals, targets=targets, event=None, project=0, project_started=False, outcome=None, log=[])
    log(e.state.campaign, 'Concordat: estabeleça três mundos, pacifique as duas potências e contenha Stargrave antes do turno 60. Comece por um processador e um poço de voláteis.')
    return e.state.campaign


def active(e):
    c = e.state.campaign
    require(c is not None, 'modo campanha indisponível')
    require(c['phase'] == 'PLAYING', 'campanha encerrada; inicie uma nova partida para jogar novamente')
    return c


def command(e, callback):
    if e.state.campaign is None:
        return callback(e)
    c = active(e)
    require(c['orders'] > 0, 'sem ordens neste turno; encerre o turno')
    result = callback(e)
    c['orders'] -= 1
    return result


def location(e, ship):
    fleet = next((f for f in e.state.fleets if ship['id'] in f['ship_ids']), None)
    if ship['ready_at'] > e.state.last_updated or (fleet and fleet['status'] == 'TRANSIT'):
        return None
    return (fleet['x'], fleet['y']) if fleet else (ship.get('system_x', e.state.system_x), ship.get('system_y', e.state.system_y))


def vessel(e, ship_id):
    ship = next((s for s in e.state.ships if s['id'] == ship_id), None)
    require(ship is not None, 'nave inexistente')
    require(location(e, ship) is not None, 'nave em montagem ou trânsito')
    require(not any(j['ship_id'] == ship_id for j in e.state.campaign['jobs']), 'nave comprometida com entrega')
    return ship


def dispatch(e, ship, x, y, mission='MOVE', index=None, intra=False):
    fleet = next((f for f in e.state.fleets if ship['id'] in f['ship_ids']), None)
    # Remote ships spend their loaded reserve, never silently debit a distant colony.
    source = e.state.planet_id if location(e, ship) == (e.state.system_x, e.state.system_y) else None
    return e.send_fleet(x, y, ship['propulsion_id'], 'NORMAL', now=e.state.last_updated, fleet_id=fleet['id'] if fleet else None, ship_id=None if fleet else ship['id'], mission=mission, target_planet_index=index, planet_id=source, intra_system=intra)


def hull(e, ship):
    return e.catalog.get('ships', ship['hull_id'])


def power(e, ships):
    c = e.state.campaign
    value = sum((hull(e, s).combat_power + hull(e, s).carrier_capacity * 5) * c['health'].get(s['id'], 100) / 100 for s in ships)
    return round(value * (1.15 if 'naval_doctrine' in e.state.research['completed'] else 1), 1)


def destroy(e, ship_id):
    c = e.state.campaign
    ship = next(s for s in e.state.ships if s['id'] == ship_id)
    log(c, f"Perdida: {hull(e, ship).name} ({ship_id[:8]}).")
    e.state.fleets = [f for f in e.state.fleets if ship_id not in f['ship_ids']]
    e.state.ships = [s for s in e.state.ships if s['id'] != ship_id]
    c['jobs'] = [j for j in c['jobs'] if j['ship_id'] != ship_id]
    c['health'].pop(ship_id, None)


def choose_event(e, choice):
    c = active(e); event = c['event']
    require(event is not None and choice in event['choices'], 'escolha de evento inválida')
    if choice == 'preserve': c['discoveries'] += 2
    elif choice == 'salvage':
        e.state.stocks['refined_alloy'] = e.state.stocks.get('refined_alloy', 0) + 80
        e.state.stocks['components'] = e.state.stocks.get('components', 0) + 25
    elif choice == 'welcome':
        e._pay({'volatiles': 10}); e.state.population_total += 20
    elif choice == 'harden': e._pay({'refined_alloy': 40})
    elif choice == 'risk': c['integrity'] = max(0, c['integrity'] - 12)
    elif choice == 'pay': e._pay({'components': 30})
    elif choice == 'refuse':
        for r in c['rivals']:
            if not r['allied'] and not r['conquered']: r['strength'] += 10
    log(c, f"{event['title']}: {choice}."); c['event'] = None


def next_turn(e):
    c = active(e)
    require(e.state.planet_id == e.state.home_planet_id, 'encerre o turno no homeworld')
    require(c['event'] is None, 'resolva o evento antes de encerrar o turno')
    e.advance(e.state.last_updated + TURN_SECONDS)
    c['turn'] += 1; c['orders'] = 4
    c['home_industry_ready'] = all(e.state.districts.get(id, 0) > 0 for id in ['processor', 'volatile_well', 'fuel_refinery'])
    e.state.population_total = min(100 + e.state.districts.get('civil_district', 0) * 80, e.state.population_total + max(1, e.state.districts.get('civil_district', 0) * 3))
    for key in sorted(e.state.system_knowledge):
        if key not in c['reports']:
            c['reports'].append(key)
            if key != f'{e.state.home_system_x}:{e.state.home_system_y}':
                science = max((hull(e, s).science_bonus for s in e.state.ships if location(e, s) == tuple(map(int, key.split(':')))), default=0)
                c['discoveries'] += int(1 + science)
                log(c, f'Levantamento {key}: +{int(1 + science)} descoberta(s).')
    for job in list(c['jobs']):
        fleet = next((f for f in e.state.fleets if job['ship_id'] in f['ship_ids']), None)
        if fleet and fleet['status'] == 'ARRIVED' and e.state.last_updated >= job['arrival_at']:
            stock = e.state.stocks_by_planet[job['destination']]
            stock[job['resource']] = stock.get(job['resource'], 0) + job['amount']
            c['deliveries'] += 1; c['jobs'].remove(job)
            log(c, f"Entrega concluída: {job['amount']:g} {job['resource']}.")
    for ship in list(e.state.ships):
        where = location(e, ship)
        if where is None: continue
        planet = next((p for p in e.state.planets if (p['x'], p['y']) == where), None)
        stock = e.state.stocks_by_planet.get(planet['id']) if planet else None
        if planet and planet['id'] == e.state.planet_id: stock = e.state.stocks
        cost = ship['mass'] * 0.02
        fleet = next((f for f in e.state.fleets if ship['id'] in f['ship_ids']), None)
        if stock is not None and stock.get(ship['fuel_id'], 0) >= cost:
            stock[ship['fuel_id']] -= cost
        elif fleet and fleet.get('fuel_reserve', 0) >= cost:
            fleet['fuel_reserve'] -= cost
        else:
            c['health'][ship['id']] = max(0, c['health'].get(ship['id'], 100) - 15)
            log(c, f"Sem suprimento: {hull(e, ship).name} perde 15 de integridade.")
            if c['health'][ship['id']] <= 0: destroy(e, ship['id'])
    home = (e.state.home_system_x, e.state.home_system_y)
    defenders = [s for s in e.state.ships if location(e, s) == home]
    for r in c['rivals']:
        r['contacted'] = f"{r['x']}:{r['y']}" in e.state.system_knowledge
        if r['conquered']: continue
        r['treasury'] += 5 + r['industry'] * 2 + r['worlds']
        if r['treasury'] >= 30:
            r['treasury'] -= 30; r['industry'] += 1; r['strength'] += 2
            r['last_action'] = 'Investiu em indústria e defesa'
        if c['turn'] % 8 == 0 and r['worlds'] < 4:
            for dx, dy in [(1, 0), (0, 1), (-1, 0), (0, -1)]:
                point = [r['x'] + dx * r['worlds'], r['y'] + dy * r['worlds']]
                reserved = [home, *((p['x'], p['y']) for p in c['targets']), *((p['x'], p['y']) for p in e.state.planets), *((f['destination_x'], f['destination_y']) for f in e.state.fleets if f['status'] == 'TRANSIT')]
                if tuple(point) not in reserved and not any(point in other['claims'] for other in c['rivals']):
                    r['claims'].append(point); r['worlds'] += 1; r['last_action'] = f'Expandiu para {point[0]}:{point[1]}'; break
        if r['allied']:
            e.state.stocks['refined_alloy'] = e.state.stocks.get('refined_alloy', 0) + 5
            e.state.stocks['components'] = e.state.stocks.get('components', 0) + 2
        elif c['turn'] >= 16 and c['turn'] % 4 == 0:
            defense = power(e, defenders) + e.state.districts.get('orbital_battery', 0) * 12
            damage = max(0, math.ceil((r['strength'] - defense) / 6))
            c['integrity'] = max(0, c['integrity'] - damage)
            r['relation'] -= 2; r['last_action'] = f'Incursão: {damage} de dano ao homeworld'
            log(c, f"{r['name']}: incursão causa {damage} de dano (defesa {defense:g}).")
    if c['project_started']:
        if e.state.stocks.get('refined_alloy', 0) >= 25 and e.state.stocks.get('components', 0) >= 10:
            e._pay({'refined_alloy': 25, 'components': 10}); c['project'] += 1
            log(c, f"Contenção Stargrave: {c['project']}/4 segmentos estabilizados.")
        else: log(c, 'Stargrave pausada: exige 25 ligas e 10 componentes por turno.')
    if c['integrity'] <= 0 or e.state.population_total <= 0:
        c['phase'] = 'DEFEAT'; c['outcome'] = 'O homeworld não resistiu às crises e incursões.'
    elif c['project'] >= 4:
        c['phase'] = 'VICTORY'; c['outcome'] = 'Concordat estabelecido. A estrela cativa foi estabilizada e três mundos têm um futuro comum.'
    elif c['turn'] >= DEADLINE:
        c['phase'] = 'DEFEAT'; c['outcome'] = 'A janela de contenção fechou. Stargrave entrou em colapso.'
    if c['phase'] == 'PLAYING' and c['turn'] in EVENTS: c['event'] = deepcopy(EVENTS[c['turn']])
    return {'turn': c['turn'], 'phase': c['phase']}


def order(e, action, *, target=None, ship_id=None, ship_ids=None, resource=None, amount=None, choice=None, x=None, y=None, planet_index=None):
    c = active(e)
    if action == 'end_turn': return next_turn(e)
    if action == 'event': return choose_event(e, choice)
    require(c['orders'] > 0, 'sem ordens neste turno')
    if action in {'dispatch', 'survey', 'colonize'}:
        ship = vessel(e, ship_id)
        require(isinstance(x, int) and isinstance(y, int) and abs(x) <= 100 and abs(y) <= 100, 'coordenadas inválidas')
        result = dispatch(e, ship, x, y, 'SURVEY' if action == 'survey' else 'COLONIZE' if action == 'colonize' else 'MOVE', planet_index if action == 'colonize' else None)
    elif action == 'cargo':
        ship = vessel(e, ship_id)
        dest = next((p for p in e.state.planets if p['id'] == target), None)
        require(dest is not None and target != e.state.planet_id, 'selecione outra colônia própria')
        require(location(e, ship) == (e.state.system_x, e.state.system_y), 'cargueiro precisa estar no sistema do planeta de origem')
        require(resource in e.catalog.items['resources'] or resource in e.catalog.items['fuels'], 'recurso inválido')
        require(isinstance(amount, (int, float)) and math.isfinite(amount) and 20 <= amount <= hull(e, ship).cargo_capacity, 'quantidade fora da capacidade de carga')
        require(e.state.stocks.get(resource, 0) >= amount, 'estoque local insuficiente')
        result = dispatch(e, ship, dest['x'], dest['y'], intra=True)
        e._pay({resource: amount})
        c['jobs'].append({'ship_id': ship['id'], 'destination': target, 'resource': resource, 'amount': amount, 'arrival_at': result['arrival_at']})
    elif action in {'envoy', 'trade', 'alliance', 'attack'}:
        r = next((r for r in c['rivals'] if r['id'] == target), None)
        require(r is not None and r['contacted'] and not r['conquered'], 'civilização não contatada ou já subjugada')
        if action == 'envoy':
            e._pay({'components': 15}); r['relation'] = min(100, r['relation'] + (25 if 'diplomatic_charter' in e.state.research['completed'] else 10)); result = {'relation': r['relation']}
        elif action == 'trade':
            require(r['relation'] >= 10, 'comércio exige relação 10')
            require(any(hull(e, s).cargo_capacity >= 100 and location(e, s) == (e.state.system_x, e.state.system_y) for s in e.state.ships), 'comércio exige cargueiro operacional no sistema local')
            e._pay({'refined_alloy': 15}); e.state.stocks['volatiles'] = e.state.stocks.get('volatiles', 0) + 45
            e.state.stocks['ion_fuel'] = e.state.stocks.get('ion_fuel', 0) + 25; r['relation'] = min(100, r['relation'] + 5); result = {'trade': True}
        elif action == 'alliance':
            require('diplomatic_charter' in e.state.research['completed'] and r['relation'] >= 60 and not r['allied'], 'aliança exige Carta interestelar, relação 60 e tratado ainda não firmado')
            e._pay({'components': 40}); r['allied'] = True; log(c, f"Tratado de segurança e comércio firmado com {r['name']}."); result = {'allied': True}
        else:
            ids = sorted(set(ship_ids or [])); require(0 < len(ids) <= 12, 'selecione de uma a doze naves')
            ships = [vessel(e, id) for id in ids]
            require(all(location(e, s) == (r['x'], r['y']) for s in ships), 'força-tarefa precisa chegar ao sistema rival')
            require(not r['allied'], 'não é possível atacar um aliado')
            strength = power(e, ships); require(strength > 0, 'força sem poder militar')
            enemy = r['strength']; victory = strength >= enemy
            damage = min(100, max(12, math.ceil(enemy / strength * 45)))
            for ship in ships:
                c['health'][ship['id']] = max(0, c['health'].get(ship['id'], 100) - damage)
                if c['health'][ship['id']] == 0: destroy(e, ship['id'])
            r['relation'] = -100; r['strength'] = max(0, enemy - strength * 0.7)
            if victory: r['conquered'] = True; r['strength'] = 0
            result = {'victory': victory, 'attacker_power': strength, 'defender_power': enemy, 'damage': damage}
            log(c, f"Batalha de {r['name']}: {'capital subjugada' if victory else 'ataque repelido'} ({strength:g} contra {enemy:g}).")
    elif action == 'decommission':
        district = e.catalog.get('districts', target)
        level = e.state.districts.get(target, 0)
        require(level > (1 if target in {'civil_district', 'solar_field', 'ore_extractor', 'processor', 'volatile_well', 'fuel_refinery'} else 0), 'mantenha a infraestrutura básica de recuperação')
        e.state.districts[target] -= 1
        for resource_id, value in district.cost.items():
            e.state.stocks[resource_id] = e.state.stocks.get(resource_id, 0) + value / 2
        log(c, f'{district.name}: um nível desmontado, metade dos materiais recuperados.')
        result = {'decommissioned': target}
    elif action == 'repair':
        ship = vessel(e, ship_id); require(location(e, ship) == (e.state.system_x, e.state.system_y), 'reparo exige nave no sistema local')
        e._pay({'refined_alloy': 15, 'components': 5}); c['health'][ship_id] = min(100, c['health'].get(ship_id, 100) + 45); result = {'health': c['health'][ship_id]}
    elif action == 'analyze':
        ship = vessel(e, ship_id); require(hull(e, ship).science_bonus > 0, 'análise exige nave científica')
        require(location(e, ship) == (e.state.system_x, e.state.system_y), 'análise exige laboratório no sistema local')
        e._pay({'volatiles': 20, 'components': 8}); c['discoveries'] += int(hull(e, ship).science_bonus); result = {'discoveries': c['discoveries']}
    elif action == 'breakthrough':
        require(c['discoveries'] > 0 and e.state.research['active'], 'exige uma descoberta e pesquisa ativa')
        c['discoveries'] -= 1; e.state.research['remaining_work'] = max(0, e.state.research['remaining_work'] - 300)
        e.advance(e.state.last_updated); result = {'remaining_work': e.state.research['remaining_work']}
    elif action == 'project':
        require(e.state.planet_id == e.state.home_planet_id, 'projeto deve ser iniciado no homeworld')
        require(not c['project_started'], 'projeto já iniciado')
        require('stellar_containment' in e.state.research['completed'], 'pesquise Contenção estelar')
        require(all(e.state.districts.get(id, 0) > 0 for id in ['processor', 'volatile_well', 'fuel_refinery']), 'mantenha a cadeia industrial do homeworld')
        require(len(e.state.planets) >= 3, 'estabeleça três mundos')
        require(all(r['allied'] or r['conquered'] for r in c['rivals']), 'pacifique ambas as potências por alianças ou conquista')
        require(c['discoveries'] >= 3 and c['deliveries'] >= 1, 'exige três descobertas preservadas e uma entrega colonial')
        e._pay({'refined_alloy': 400, 'components': 150}); c['project_started'] = True; result = {'project_started': True}
        log(c, 'Stargrave: contenção iniciada. Quatro turnos, 25 ligas e 10 componentes por turno.')
    else: raise DataValidationError('ordem de campanha desconhecida')
    c['orders'] -= 1
    return result


def snapshot(e):
    if e.state.campaign is None: return None
    c = deepcopy(e.state.campaign)
    c.update(deadline=DEADLINE, turn_seconds=TURN_SECONDS)
    c['fleet_power'] = power(e, [s for s in e.state.ships if location(e, s) is not None])
    c['objectives'] = [
        {'title': 'Indústria sustentável: processador, voláteis e combustível', 'done': all(e.state.districts.get(id, 0) > 0 for id in ['processor', 'volatile_well', 'fuel_refinery']) if e.state.planet_id == e.state.home_planet_id else c.get('home_industry_ready', False)},
        {'title': 'Três mundos colonizados', 'done': len(e.state.planets) >= 3},
        {'title': 'Duas potências pacificadas por diplomacia ou conquista', 'done': all(r['allied'] or r['conquered'] for r in c['rivals'])},
        {'title': 'Uma entrega de carga entre colônias', 'done': c['deliveries'] > 0},
        {'title': 'Três descobertas preservadas', 'done': c['discoveries'] >= 3},
        {'title': 'Pesquisa: Contenção estelar', 'done': 'stellar_containment' in e.state.research['completed']},
        {'title': 'Stargrave estabilizada (quatro turnos)', 'done': c['project'] >= 4},
    ]
    c['tutorial'] = next((o['title'] for o in c['objectives'] if not o['done']), 'Concordat concluído')
    c['sector'] = [dict(x=t['x'], y=t['y'], kind='colony_signal', surveyed=e.knowledge_level(t['x'], t['y']) == 'SURVEYED', planet_index=t['planet_index'] if e.knowledge_level(t['x'], t['y']) == 'SURVEYED' else None) for t in c['targets']]
    for r in c['rivals']: c['sector'].append(dict(x=r['x'], y=r['y'], kind=r['id'], surveyed=r['contacted'], planet_index=None))
    # Internal delivery scheduling is exposed for inspection, not editable by clients.
    return c
