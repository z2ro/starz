import {StatusIndicator} from '../../pixel-command/master/MasterUI';
import type { ReactNode } from 'react';

export type Tone = 'default' | 'positive' | 'warning' | 'research' | 'danger' | 'active' | 'neutral' | 'good' | 'blue' | 'warn';

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: Tone }) {
  return <StatusIndicator tone={tone}>{children}</StatusIndicator>;
}
