import { percent } from '../../app/format';

export function Progress({ value, text }: { value: number; text?: string }) {
  return <><div className="progress" aria-label={text}><i style={{ width: `${percent(value)}%` }} /></div>{text && <small>{text}</small>}</>;
}
