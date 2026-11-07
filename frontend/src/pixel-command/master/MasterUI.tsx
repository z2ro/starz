import type {ButtonHTMLAttributes, ReactNode} from 'react';
import {Link} from 'react-router-dom';
import {Tabs} from '../../components/ui/Tabs';
import {PixelIcon, type PixelIconName} from '../PixelIcon';

/** One approved application shell for every persistent-universe workspace. */
export function GameShell({children}:{children:ReactNode}) {
 return <div className="master-ui game-shell">{children}</div>;
}
export function PixelPanel({children,className='',label}:{children:ReactNode;className?:string;label?:string}) {
 return <section className={`pixel-panel ${className}`} aria-label={label}>{children}</section>;
}
export function PixelButton({variant='secondary',className='',...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'secondary'|'ghost'|'danger'}) {
 return <button {...props} className={`pixel-button pixel-button-${variant} ${className}`}/>;
}
export function PixelAction({to,icon,children,primary=false}:{to:string;icon:PixelIconName;children:ReactNode;primary?:boolean}) {
 return <Link to={to} className={`pixel-button ${primary?'pixel-button-primary px-primary':'pixel-button-secondary'}`}><PixelIcon name={icon}/>{children}</Link>;
}
export function PixelTabs<T extends string>(props:Parameters<typeof Tabs<T>>[0]) {
 return <div className="pixel-tabs"><Tabs {...props}/></div>;
}
export function WorkspaceHeader({title,icon,as:Tag='header'}:{title:string;icon:PixelIconName;as?:'header'|'div'}) {
 return <Tag className="workspace-header"><PixelIcon name={icon}/><h1>{title}</h1><div aria-hidden="true"/></Tag>;
}
export function ContextInspector({title,children,className='',heading=true,state}:{title:string;children:ReactNode;className?:string;heading?:boolean;state?:string}) {
 return <aside className={`context-inspector ${className}`} aria-label={title} data-state={state} aria-busy={state==='loading'||undefined}>{heading&&<h3>{title}</h3>}{children}</aside>;
}

export function StatusIndicator({children,tone='default'}:{children:ReactNode;tone?:string}) {
 return <span className={`badge status-indicator tone-${tone}`}>{children}</span>;
}
