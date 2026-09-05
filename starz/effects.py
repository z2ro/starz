"""Only supported effect: technology unlocks, derived from completed research."""
from .data import Catalog, Content, DataValidationError, Technology


def unlock_content(technology: Technology, unlocked: set[str]) -> None:
    unlocked.update(technology.unlocks)


EFFECT_HANDLERS = {'unlock_content': unlock_content}


def unlocked_content(catalog: Catalog, completed: list[str]) -> set[str]:
    unlocked: set[str] = set()
    for technology_id in sorted(completed):
        technology = catalog.get('technologies', technology_id)
        EFFECT_HANDLERS['unlock_content'](technology, unlocked)
    return unlocked


def require_available(catalog: Catalog, state, item: Content) -> None:
    completed = state.research['completed']
    if any(target == item.id for tech in catalog.items['technologies'].values() for target in tech.unlocks):
        if item.id not in unlocked_content(catalog, completed):
            raise DataValidationError(f'conteúdo bloqueado por pesquisa: {item.id}')
    for ref in item.requires:
        met = ref in completed if ref in catalog.items['technologies'] else state.districts.get(ref, 0) > 0
        if not met:
            raise DataValidationError(f'{item.id}: requer {ref}')
