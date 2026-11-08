"""Travel math has no implicit home-system origin or clock."""
import math

from .data import Catalog, DataValidationError


def travel_distance(origin, destination, *, intra_system=False):
    distance = math.dist(origin, destination)
    if intra_system and distance == 0:
        distance = 0.25
    if not math.isfinite(distance) or distance <= 0:
        raise DataValidationError('destino deve ser diferente da posição atual')
    return distance


def travel_seconds(distance, speed_factor, time_modifier=1):
    return max(1, round(distance * 180 * time_modifier / speed_factor))


def preview_travel(catalog: Catalog, origin: tuple[int, int], destination: tuple[int, int], ship: dict, propulsion_id: str, mode: str, *, intra_system: bool = False) -> dict:
    propulsion = catalog.get('propulsion', propulsion_id)
    regime = catalog.get('travel_modes', mode)
    fuel = catalog.get('fuels', ship['fuel_id'])
    hull = catalog.get('ships', ship['hull_id'])
    if propulsion_id != ship['propulsion_id'] or propulsion_id not in hull.compatible_propulsion:
        raise DataValidationError('propulsão incompatível ou não instalada')
    if ship['fuel_id'] not in propulsion.compatible_fuels:
        raise DataValidationError('combustível incompatível com a propulsão')
    distance = travel_distance(origin, destination, intra_system=intra_system)
    fuel_cost = math.ceil(ship['mass'] * distance * regime.fuel_modifier / propulsion.fuel_efficiency / fuel.energy_density)
    seconds = travel_seconds(distance, propulsion.speed_factor, regime.travel_time_modifier)
    return {
        'origin': list(origin), 'destination': list(destination), 'distance': distance,
        'eta_seconds': seconds, 'fuel_cost': fuel_cost, 'mode': mode,
        'heat': round(propulsion.thermal_load * regime.thermal_modifier, 2),
        'signature': round(propulsion.signature * regime.signature_modifier, 2),
    }
