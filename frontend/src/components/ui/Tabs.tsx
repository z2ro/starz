export function Tabs<T extends string>({ items, value, onChange, label }: { items: Array<{ id: T; label: string }>; value: T; onChange: (value: T) => void; label: string }) {
  return <div className="tabs" role="tablist" aria-label={label}>{items.map(item => <button type="button" role="tab" aria-selected={item.id === value} className={item.id === value ? 'active' : ''} key={item.id} onClick={() => onChange(item.id)}>{item.label}</button>)}</div>;
}
