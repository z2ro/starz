import { percent } from '../../app/format';
import type { Tone } from './Badge';

export function Progress({ value, text, tone = 'active' }: { value: number; text?: string; tone?: Tone }) {
  return <><div className={`progress tone-${tone}`} aria-label={text} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent(value)} role="progressbar"><i style={{ width: `${percent(value)}%` }} /></div>{text && <small>{text}</small>}</>;
}
