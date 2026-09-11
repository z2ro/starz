import type { CSSProperties } from 'react';
import { ICONS, type IconName } from '../../visual/IconRegistry';

export function Icon({ name, className = 'ui-icon', label }: { name: IconName; className?: string; label?: string }) {
  return <span className={className} aria-hidden={label ? undefined : true} aria-label={label} style={{ '--icon': `url('${ICONS[name]}')` } as CSSProperties} />;
}
