import type { ButtonHTMLAttributes } from 'react';
import type { IconName } from '../../visual/IconRegistry';
import { Icon } from './Icon';

export function IconButton({ icon, label, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string }) {
  return <button className={`icon-button ${className}`} aria-label={label} {...props}><Icon name={icon} className="ui-icon button-pictogram" /></button>;
}
