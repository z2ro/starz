import type { ReactNode } from 'react';

export type Tone = 'default' | 'positive' | 'warning' | 'research' | 'danger' | 'active' | 'neutral' | 'good' | 'blue' | 'warn';

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`badge tone-${tone}`}>{children}</span>;
}
