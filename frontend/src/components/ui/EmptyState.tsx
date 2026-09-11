import type { ReactNode } from 'react';
import type { IconName } from '../../visual/IconRegistry';
import { Icon } from './Icon';

export function EmptyState({ title, children, action, icon = 'operations' }: { title: string; children: ReactNode; action?: ReactNode; icon?: IconName }) {
  return <div className="empty"><Icon name={icon} className="ui-icon empty-symbol" /><strong>{title}</strong><p>{children}</p>{action}</div>;
}
