"""Travel math has no implicit home-system origin or clock."""
import math

from .data import Catalog, DataValidationError


def preview_travel(catalog: Catalog, origin: tuple[int, int], destination: tuple[int, int], ship: dict, propulsion_id: str, mode: str, *, intra_system: bool = False) -> dict:
    propulsion = catalog.get('propulsion', propulsion_id)
    regime = catalog.get('travel_modes', mode)
    fuel = catalog.get('fuels', ship['fuel_id'])
    hull = catalog.get('ships', ship['hull_id'])
    if propulsion_id != ship['propulsion_id'] or propulsion_id not in hull.compatible_propulsion:
        raise DataValidationError('propulsão incompatível ou não instalada')
    if ship['fuel_id'] not in propulsion.compatible_fuels:
        raise DataValidationError('combustível incompatível com a propulsão')
    distance = math.dist(origin, destination)
    if intra_system and distance == 0:
        distance = 0.25
    if not math.isfinite(distance) or distance <= 0:
        raise DataValidationError('destino deve ser diferente da posição atual')
    fuel_cost = math.ceil(ship['mass'] * distance * regime.fuel_modifier / propulsion.fuel_efficiency / fuel.energy_density)
    seconds = max(1, round(distance * 180 * regime.travel_time_modifier / propulsion.speed_factor))
    return {
        'origin': list(origin), 'destination': list(destination), 'distance': distance,
        'eta_seconds': seconds, 'fuel_cost': fuel_cost, 'mode': mode,
        'heat': round(propulsion.thermal_load * regime.thermal_modifier, 2),
        'signature': round(propulsion.signature * regime.signature_modifier, 2),
    }
