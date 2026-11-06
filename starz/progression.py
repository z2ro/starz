"""Open-ended research and building formulas, shared by simulation and previews."""
from math import ceil
from .data import DataValidationError

EFFECTS = {'energy_efficiency', 'energy', 'mining', 'processing', 'components', 'fleet_slots', 'sensors', 'espionage', 'counter_intelligence', 'speed', 'weapons', 'shields', 'armor', 'cargo', 'fuel', 'colonies', 'workforce', 'research', 'ship_speed', 'defense', 'carrier', 'transport', 'build_speed', 'alloy', 'population', 'expedition', 'storage', 'recruitment'}


def level(state, key):
    return (state.universe or {}).get('levels', {}).get(key, 0)


DOMAINS = ('civil', 'military', 'fundamental')
TIER_CAPACITY = (1, 3, 6, 10, 15)


def technology_effects(tech, value):
    result = {key: bonus * value for key, bonus in tech.effects.items()}
    for milestone, effects in tech.milestones.items():
        if value >= milestone:
            for key, bonus in effects.items(): result[key] = result.get(key, 0) + bonus
    return result


def effect(catalog, state, key):
    return sum(technology_effects(tech, level(state, tech.id)).get(key, 0) for tech in catalog.items['technologies'].values()) if state.universe is not None else 0


def grant_legacy_tiers(state, tech, stamp):
    for tier in range(2, tech.tier + 1):
        gate = f'{tech.domain}_tier_{tier}'
        state.universe.setdefault('levels', {}).setdefault(gate, 1)
        if gate not in state.research['completed']:
            state.research['completed'].append(gate)
            state.research.setdefault('completed_at', {})[gate] = stamp


def migrate_research(catalog, state):
    if state.universe is None: return
    state.universe.setdefault('research_schema', 2)
    if 'research_domains' not in state.universe:
        jobs = {domain: {'active': None, 'remaining_work': 0, 'complete_at': None} for domain in DOMAINS}
        if state.research['active']:
            tech = catalog.get('technologies', state.research['active'])
            jobs[tech.domain].update({key: state.research[key] for key in ('active', 'remaining_work', 'complete_at')})
            jobs[tech.domain]['legacy_rate'] = True
        state.universe['research_domains'] = jobs
        # Existing discoveries keep their effects and imply the tiers already reached.
        for tech in catalog.items['technologies'].values():
            if level(state, tech.id) > 0:
                grant_legacy_tiers(state, tech, state.last_updated)



def research_quote(catalog, state, key):
    tech = catalog.get('technologies', key)
    current = level(state, key)
    reasons = []
    maximum = 1 if tech.kind == 'breakthrough' else 50
    target = min(current + 1, maximum)
    if current >= maximum:
        reasons.append('Projeto único já concluído.' if tech.kind == 'breakthrough' else 'Nível máximo: 50.')
    for ref in tech.requires:
        if ref in catalog.items['technologies'] and level(state, ref) < 1:
            reasons.append(f'{catalog.get("technologies", ref).name}: nível 1')
        elif ref in catalog.items['districts'] and state.districts.get(ref, 0) < 1:
            reasons.append(f'{catalog.get("districts", ref).name}: nível 1')
    for ref, required in tech.level_requires.items():
        if level(state, ref) < required:
            reasons.append(f'{catalog.get("technologies", ref).name}: nível {required}')
    for ref, required in tech.infrastructure.items():
        if state.districts.get(ref, 0) < required:
            reasons.append(f'{catalog.get("districts", ref).name}: nível {required} no planeta selecionado')
    science = state.science_global or {}
    capacity = science.get(tech.domain, {}).get('capacity', state.districts.get('research_lab', 0) + state.districts.get(f'{tech.domain}_lab', 0))
    if capacity < TIER_CAPACITY[tech.tier - 1]:
        reasons.append(f'Capacidade {tech.domain}: {capacity:g}/{TIER_CAPACITY[tech.tier - 1]}')
    if tech.tier > 1 and not tech.advances_tier and level(state, f'{tech.domain}_tier_{tech.tier}') < 1:
        reasons.append(f'Concluir avanço {tech.domain} tier {tech.tier}')
    if tech.tier > 1 and science.get(tech.domain, {}).get('specialized', state.districts.get(f'{tech.domain}_lab', 0)) < 1:
        reasons.append(f'Construir instalação especializada: {tech.domain}')
    costs = {r: ceil(v * tech.level_cost_growth ** current) for r, v in tech.cost.items()}
    work = ceil(tech.duration * tech.level_work_growth ** current)
    return {'id': key, 'level': current, 'next_level': target, 'cost': costs, 'work': work, 'requirements': reasons, 'domain': tech.domain, 'tier': tech.tier, 'kind': tech.kind, 'max_level': 1 if tech.kind == 'breakthrough' else 50, 'milestones': tech.milestones, 'effects': {k: {'current': technology_effects(tech,current).get(k,0), 'next': technology_effects(tech,target).get(k,0)} for k in set(technology_effects(tech,current)) | set(technology_effects(tech,target))}, 'cost_growth': tech.level_cost_growth, 'work_growth': tech.level_work_growth}


def building_quote(catalog, state, key):
    district = catalog.get('districts', key)
    current = state.districts.get(key, 0) + sum(j['id'] == key for j in state.construction)
    if current >= 50:
        raise DataValidationError('Limite de segurança: construção nível 50.')
    return {'id': key, 'level': current, 'next_level': current + 1, 'cost': {r: ceil(v * 1.6 ** current) for r, v in district.cost.items()}, 'duration': max(1, ceil(district.duration * 1.4 ** current / (1 + effect(catalog, state, 'build_speed')))), 'production_multiplier': (current + 1) * 1.08 ** current, 'cost_growth': 1.6, 'time_growth': 1.4}
