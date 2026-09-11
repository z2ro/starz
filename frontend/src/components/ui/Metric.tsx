import type { ReactNode } from 'react';
import type { Tone } from './Badge';

export function Metric({ label, value, detail, tone = 'default', className = '' }: { label: string; value: ReactNode; detail?: ReactNode; tone?: Tone; className?: string }) {
  return <div className={`metric metric-${tone} ${className}`}><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong>{detail && <span className="metric-detail">{detail}</span>}</div>;
}
