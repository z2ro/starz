import type { ReactNode } from 'react';
import type { Tone } from './Badge';

export function DataRow({ label, value, unit, status, visualization, tone = 'default' }: { label: string; value: ReactNode; unit?: string; status?: ReactNode; visualization?: ReactNode; tone?: Tone }) {
  return <div className={`data-row tone-${tone}`}><span className="data-label">{label}</span><div className="data-row-value"><strong>{value}</strong>{unit && <small>{unit}</small>}</div>{visualization && <div className="data-row-visualization">{visualization}</div>}{status && <span className="data-row-status">{status}</span>}</div>;
}
