export function EmptyState({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <div className="empty"><div className="empty-symbol">◇</div><strong>{title}</strong><p>{children}</p>{action}</div>;
}
