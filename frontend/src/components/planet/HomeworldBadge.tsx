import { Icon } from '../ui/Icon';

/** Identifies the empire's capital world without inheriting the generic status-dot badge. */
export function HomeworldBadge() {
  return <span className="homeworld-badge" aria-label="Homeworld — mundo principal do império">
    <Icon name="planetActive" className="ui-icon" />
    <span className="homeworld-badge-wide">HOMEWORLD</span>
    <span className="homeworld-badge-compact" aria-hidden="true">HOME</span>
  </span>;
}
