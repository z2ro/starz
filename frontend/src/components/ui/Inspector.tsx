import type { ReactNode } from 'react';

export type InspectorState = 'default' | 'loading' | 'empty' | 'unavailable' | 'warning' | 'error';

export function Inspector({ label, header, summary, children, className = '', state = 'default' }: { label: string; header?: ReactNode; summary?: ReactNode; children: ReactNode; className?: string; state?: InspectorState }) {
  return <aside className={`inspector ${className}`} aria-label={label} data-state={state} aria-busy={state === 'loading' || undefined}>{header}{summary && <div className="inspector-summary">{summary}</div>}<div className="inspector-content">{children}</div></aside>;
}

export function InspectorSection({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <section className="inspector-section"><div className="inspector-section-header"><h2>{title}</h2>{action}</div>{children}</section>;
}
