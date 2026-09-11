import type { ReactNode } from 'react';

export function SectionHeader({ title, eyebrow, action, count }: { title: string; eyebrow?: string; action?: ReactNode; count?: number }) {
  return <header className="section-header"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>{(count !== undefined || action) && <div className="section-header-action">{count !== undefined && <b>{count}</b>}{action}</div>}</header>;
}
