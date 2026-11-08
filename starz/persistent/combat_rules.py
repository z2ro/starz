"""Experimental D08 parameters and side-effect-free Combat 3.0 helpers."""
from math import ceil, isfinite

from ..data import DataValidationError
from ..progression import level


# Trial values, not approved production balance.
EXPERIMENTS = {
    'conservative': {'shield': 1.1, 'hull': .9, 'delay': .1, 'delay_cap': 600},
    'intermediate': {'shield': 1.25, 'hull': .8, 'delay': .25, 'delay_cap': 1800},
    'elevated': {'shield': 1.4, 'hull': .7, 'delay': .4, 'delay_cap': 3600},
}


def experiment_rules(experiment):
    if not isinstance(experiment, str) or experiment not in EXPERIMENTS:
        raise DataValidationError('Experimento de combate inválido.')
    return EXPERIMENTS[experiment]


def combat_config(config=None):
    result = {'version': 1, 'doctrine': 'balanced', 'weapon_profile': 'standard',
              'experiment': 'intermediate'}
    if config is not None:
        if not isinstance(config, dict) or config.keys() - result.keys():
            raise DataValidationError('Configuração de combate inválida.')
        result.update(config)
    if type(result['version']) is not int or result['version'] != 1:
        raise DataValidationError('Versão de combate inválida.')
    if result['doctrine'] not in ('balanced', 'interception', 'rupture'):
        raise DataValidationError('Doutrina de combate inválida.')
    if result['weapon_profile'] not in ('standard', 'anti_shield'):
        raise DataValidationError('Perfil de arma inválido.')
    experiment_rules(result['experiment'])
    return result


def ew_contest(emitter_engine, units, observer_engine, experiment='intermediate'):
    """True only for effective EW; callers supply actual local/participating units.

    Experimental contest: sensors + computing, strict advantage; ties resist.
    Multiple living Odyssey provide redundancy, never additional strength.
    """
    experiment_rules(experiment)
    if level(emitter_engine.state, 'electronic_warfare') < 1:
        return False
    if not any(u['kind'] == 'ship' and u['type'] == 'odyssey_hull' and u['hp'] > 0
               for u in units):
        return False
    strength = sum(level(emitter_engine.state, key) for key in ('sensor_array', 'computing'))
    resistance = sum(level(observer_engine.state, key) for key in ('sensor_array', 'computing'))
    return strength > resistance


def interdiction_delay(duration, experiment='intermediate'):
    rules = experiment_rules(experiment)
    if isinstance(duration, bool) or not isinstance(duration, (int, float)) or not isfinite(duration) or duration < 0:
        raise DataValidationError('Duração de viagem inválida.')
    return min(ceil(duration * rules['delay']), rules['delay_cap'])
