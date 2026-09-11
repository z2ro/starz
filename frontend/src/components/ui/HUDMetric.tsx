import type { ReactNode } from 'react';
import type { IconName } from '../../visual/IconRegistry';
import type { Tone } from './Badge';
import { Icon } from './Icon';

export function HUDMetric({ icon, label, value, detail, tone = 'default' }: { icon?: IconName; label: string; value: ReactNode; detail?: ReactNode; tone?: Tone }) {
  return <div className={`hud-metric tone-${tone}`}>{icon && <span className="hud-metric-icon"><Icon name={icon} className="ui-icon" /></span>}<div><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong>{detail && <span className="metric-detail">{detail}</span>}</div></div>;
}
