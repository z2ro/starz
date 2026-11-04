"""Open-ended research and building formulas, shared by simulation and previews."""
from math import ceil
from .data import DataValidationError

EFFECTS = {'energy', 'mining', 'processing', 'components', 'fleet_slots', 'sensors', 'espionage', 'counter_intelligence', 'speed', 'weapons', 'shields', 'armor', 'cargo', 'fuel', 'colonies', 'workforce', 'research', 'ship_speed', 'defense', 'carrier', 'transport', 'build_speed', 'alloy', 'population', 'expedition', 'storage', 'repair', 'recruitment'}


def level(state, key):
    return (state.universe or {}).get('levels', {}).get(key, 0)


def effect(catalog, state, key):
    return sum(tech.effects.get(key, 0) * level(state, tech.id) for tech in catalog.items['technologies'].values()) if state.universe is not None else 0


def research_quote(catalog, state, key):
    tech = catalog.get('technologies', key)
    current = level(state, key)
    reasons = []
    if current >= 50:
        reasons.append('Limite de segurança do protótipo: nível 50.')
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
    costs = {r: ceil(v * tech.level_cost_growth ** current) for r, v in tech.cost.items()}
    work = ceil(tech.duration * tech.level_work_growth ** current)
    return {'id': key, 'level': current, 'next_level': current + 1, 'cost': costs, 'work': work, 'requirements': reasons, 'effects': {k: {'current': v * current, 'next': v * (current + 1)} for k, v in tech.effects.items()}, 'cost_growth': tech.level_cost_growth, 'work_growth': tech.level_work_growth}


def building_quote(catalog, state, key):
    district = catalog.get('districts', key)
    current = state.districts.get(key, 0) + sum(j['id'] == key for j in state.construction)
    if current >= 50:
        raise DataValidationError('Limite de segurança: construção nível 50.')
    return {'id': key, 'level': current, 'next_level': current + 1, 'cost': {r: ceil(v * 1.6 ** current) for r, v in district.cost.items()}, 'duration': max(1, ceil(district.duration * 1.4 ** current / (1 + effect(catalog, state, 'build_speed')))), 'production_multiplier': (current + 1) * 1.08 ** current, 'cost_growth': 1.6, 'time_growth': 1.4}
