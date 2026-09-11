import type { ReactNode } from 'react';
import type { IconName } from '../../visual/IconRegistry';
import type { Tone } from './Badge';
import { Icon } from './Icon';
import { Progress } from './Progress';

export function OperationsDeck({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`operations-deck ${className}`} aria-label="Operações ativas">{children}</section>;
}

export function OperationsColumn({ icon, title, count, action, children }: { icon: IconName; title: string; count?: number; action?: ReactNode; children: ReactNode }) {
  return <section className="operations-column"><header><div><Icon name={icon} className="ui-icon" /><h2>{title}</h2>{count !== undefined && <b>{count}</b>}</div>{action}</header>{children}</section>;
}

export function QueueItem({ title, meta, progress, eta, status, tone = 'active', thumbnail, action }: { title: string; meta?: ReactNode; progress?: number; eta?: ReactNode; status?: ReactNode; tone?: Tone; thumbnail?: ReactNode; action?: ReactNode }) {
  return <article className="queue-item">{thumbnail && <div className="queue-item-thumbnail">{thumbnail}</div>}<div className="queue-item-content"><div><strong>{title}</strong>{status && <span>{status}</span>}</div>{meta && <small>{meta}</small>}{progress !== undefined && <Progress value={progress} tone={tone} />}{eta && <time>{eta}</time>}</div>{action && <div className="queue-item-action">{action}</div>}</article>;
}
