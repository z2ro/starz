import { useContext, type CSSProperties } from 'react';
import { PixelIcon, PixelTheme, resourcePixelIcons, type PixelIconName } from '../../pixel-command/PixelIcon';
import { ICONS, type IconName } from '../../visual/IconRegistry';

const pixelNames: Record<IconName, PixelIconName> = {overview:'command',planet:'planet',planetActive:'planet',economy:'ore',research:'research',shipyard:'build',fleets:'ship',galaxy:'map',energy:'energy',population:'people',operations:'build',system:'map',notifications:'log',settings:'parts',rawOre:'ore',refinedAlloy:'ingots',components:'chip',fusionFuel:'fusion'};
export function Icon({ name, className = 'ui-icon', label,resourceId }: { name: IconName; className?: string; label?: string;resourceId?:string }) {
  const pixel = useContext(PixelTheme);
  if (pixel) return <span className={`${className} px-semantic-icon`} aria-hidden={label ? undefined : true} aria-label={label}><PixelIcon name={(resourceId&&resourcePixelIcons[resourceId])||pixelNames[name]}/></span>;
  return <span className={className} aria-hidden={label ? undefined : true} aria-label={label} style={{ '--icon': `url('${ICONS[name]}')` } as CSSProperties} />;
}
