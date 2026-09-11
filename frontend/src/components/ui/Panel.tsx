import type { ReactNode } from 'react';

export type PanelVariant = 'default' | 'raised' | 'glass' | 'interactive';

export function Panel({ title, eyebrow, children, className = '', variant = 'default' }: { title: string; eyebrow?: string; children: ReactNode; className?: string; variant?: PanelVariant }) {
  return <section className={`panel panel-${variant} ${className}`}>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h2>{title}</h2>{children}</section>;
}
