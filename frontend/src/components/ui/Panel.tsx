export function Panel({ title, eyebrow, children, className = '' }: { title: string; eyebrow?: string; children: React.ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h2>{title}</h2>{children}</section>;
}
