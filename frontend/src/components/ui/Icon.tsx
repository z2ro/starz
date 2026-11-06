import { useContext, type CSSProperties } from 'react';
import { PixelIcon, PixelTheme, type PixelIconName } from '../../pixel-command/PixelIcon';
import { ICONS, type IconName } from '../../visual/IconRegistry';

const pixelNames: Record<IconName, PixelIconName> = {overview:'command',planet:'planet',planetActive:'planet',economy:'ore',research:'research',shipyard:'build',fleets:'ship',galaxy:'map',energy:'energy',population:'people',operations:'build',system:'map',notifications:'log',settings:'parts',rawOre:'ore',refinedAlloy:'alloy',components:'parts',fusionFuel:'fuel'};
export function Icon({ name, className = 'ui-icon', label }: { name: IconName; className?: string; label?: string }) {
  const pixel = useContext(PixelTheme);
  if (pixel) return <span className={`${className} px-semantic-icon`} aria-hidden={label ? undefined : true} aria-label={label}><PixelIcon name={pixelNames[name]}/></span>;
  return <span className={className} aria-hidden={label ? undefined : true} aria-label={label} style={{ '--icon': `url('${ICONS[name]}')` } as CSSProperties} />;
}
