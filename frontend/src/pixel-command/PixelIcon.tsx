import { createContext } from 'react';
export const PixelTheme = createContext(false);
// Filled shapes on an integer 16px grid; labels belong to the surrounding control.
const shapes = {
  chip: ['M4 3h8v10H4zM1 4h3v2H1zM1 8h3v2H1zM1 12h3v2H1zM12 4h3v2h-3zM12 8h3v2h-3zM12 12h3v2h-3zM5 1h2v2H5zM9 1h2v2H9zM5 13h2v2H5zM9 13h2v2H9z','M5 4h6v7H5z','M6 5h3v3H6z'],
  ingots: ['M3 2h9l2 4H1zM2 7h11l2 5H0zM1 12h14v2H1z','M4 3h7v1H4zM3 8h9v2H3z','M3 12h10v1H3z'],
  gas: ['M6 1h4v2h2v2h1v9H3V5h1V3h2z','M5 5h6v7H5z','M6 1h2v2H6zM5 7h6v2H5z'],
  fusion: ['M5 1h6v3h2v11H3V4h2z','M5 5h6v6H5z','M7 6h2v2h1v2H6V8h1zM5 12h6v1H5z'],
  ion: ['M6 1h4v3h2v2h1v9H3V6h1V4h2z','M5 6h6v6H5z','M7 6h3L8 9h2l-4 3 1-3H5z'],
  overview: ['M1 1h6v6H1zM9 1h6v6H9zM1 9h6v6H1zM9 9h6v6H9z','M2 2h3v3H2zM10 10h3v3h-3z'],
  empire: ['M7 1h2v1h2v1h2v1h2v2h-2v1h-2v1H9v1H7V8H5V7H3V6H1V4h2V3h2V2h2zM1 9h2v1h2v1h2v1h2v-1h2v-1h2V9h2v2h-2v1h-2v1H9v1H7v-1H5v-1H3v-1H1z','M7 3h2v1h3v1H9v1H7V5H4V4h3z'],
  workforce: ['M7 1h2v5h4V4h1v4H2V4h1v2h4zM4 2h2v4H4zM10 2h2v4h-2zM3 10h10v4H3z','M4 11h8v1H4z'],
  tools: ['M2 1h2v3h2V1h2v5L6 8l8 6-2 2L4 9 1 6V3h1zM12 1h2v3l-3 3-2-2z','M3 5h2v1H3z'],
  sector: ['M5 1h6v1h2v2h1v5h-2v2h-2v2H9v2H7v-2H6v-2H4V9H2V4h1V2h2z','M6 3h4v1h1v4h-1v1H6V8H5V4h1z'],
  universe: ['M5 1h6v1h2v2h2v2h1v5h-1v2h-2v2h-2v1H5v-1H3v-2H1v-2H0V6h1V4h2V2h2z','M6 2h1v3H4v1H2v4h2v1h3v3h2v-3h3v-1h2V6h-2V5H9V2z'],
  logout: ['M7 1h3v3H7zM2 4h2v8h8v-2h2v4H2zM8 5h4V3l4 4-4 4V9H8z','M3 5h1v5H3z'],
  temperature: ['M6 1h4v9h2v4h-2v1H6v-1H4v-4h2z','M7 3h1v8H6v2h4v-2H9V3z'],
  gravity: ['M6 1h4v3H6zM4 5h8l3 10H1z','M6 7h4v2H6z'],
  water: ['M7 1h2v2h1v2h2v3h2v5h-2v2H4v-2H2V8h2V5h2V3h1z','M4 9h2v3h2v1H5v-1H4z'],
  cannon: ['M2 12h12v3H2zM5 9h6v3H5zM6 5h5v4H6zM8 1h3v5H8z','M7 6h3v2H7zM4 13h8v1H4z'],
  missile: ['M7 1h2v2h2v7h2v4h-3v-2H6v2H3v-4h2V3h2zM7 13h2v3H7z','M7 4h2v3H7z'],
  railgun: ['M1 12h14v3H1zM5 8h7v4H5zM7 1h2v8H7zM11 1h2v8h-2z','M6 10h5v1H6zM3 13h10v1H3z'],
  shield: ['M2 2l6-1 6 1v7l-2 3-4 3-4-3-2-3z','M4 4h2v5l2 2v2l-4-3zM8 3h4v2H8z'],
  platform: ['M5 1h6v4h4v6h-4v4H5v-4H1V5h4z','M6 6h4v4H6zM2 7h2v2H2zM12 7h2v2h-2z'],
  intercept: ['M1 1h5v2H3v3H1zM10 1h5v5h-2V3h-3zM1 10h2v3h3v2H1zM13 10h2v5h-5v-2h3zM7 5h2v6H7z','M5 7h6v2H5z'],
  command: ['M2 3h12v9H2zM5 12h6v2H5z', 'M4 5h3v2H4zM9 5h3v1H9zM9 8h3v1H9zM4 9h3v1H4z'],
  planet: ['M5 1h6v2h2v2h2v6h-2v2h-2v2H5v-2H3v-2H1V5h2V3h2z', 'M5 3h3v2h2v3H7v2H5V7H3V5h2zM9 11h4v2H9z'],
  build: ['M2 6h3V3h3v4l4-2v3h2v7H2z', 'M4 10h2v2H4zM8 10h2v2H8zM12 10h1v2h-1zM3 1h4v1H3z'],
  research: ['M5 1h6v2H9v4l5 6v2H2v-2l5-6V3H5z', 'M6 10h4v2H6zM4 12h8v1H4z'],
  ship: ['M7 1h2v3h2v3h2v3h2v3h-5v-2H6v2H1v-3h2V7h2V4h2z', 'M7 5h2v4H7zM3 14h3v2H3zM10 14h3v2h-3z'],
  map: ['M2 1h3v3H2zM11 3h3v3h-3zM5 11h4v4H5zM4 4h2v2H4zM6 6h6v1H6zM7 7h1v4H7z', 'M3 2h1v1H3zM12 4h1v1h-1zM6 12h2v2H6z'],
  ore: ['M5 2h5v2h3v3h2v5h-3v2H4v-2H1V7h2V4h2z', 'M5 4h4v3H5zM3 8h3v3H3zM9 8h3v4H9z'],
  alloy: ['M4 3h9l2 5v5H1V8z', 'M4 5h8v2H4zM3 9h10v2H3z'],
  parts: ['M5 1h6v3h3v8h-3v3H5v-3H2V4h3z', 'M6 5h4v6H6zM1 6h2v1H1zM13 9h2v1h-2z'],
  fuel: ['M5 1h6v3h2v10H3V4h2z', 'M5 6h6v4H5zM5 12h6v1H5z'],
  energy: ['M8 1h5L9 6h4L5 15l2-6H3z', 'M8 3h2L6 7h3L6 11l1-3H5z'],
  people: ['M5 1h5v5H5zM3 8h9v7H3zM12 3h3v4h-3zM13 9h3v5h-3z', 'M5 10h2v5H5zM5 2h3v2H5z'],
  log: ['M3 1h9v2h2v12H2V1z', 'M5 4h6v1H5zM5 7h6v1H5zM5 10h4v1H5z'],
  help: ['M4 1h8v2h2v4h-2v2H9v2H6V7h4V4H6v2H2V3h2zM6 13h3v3H6z', 'M5 2h6v1H5z'],
} as const;
export type PixelIconName = keyof typeof shapes;
export const resourcePixelIcons:Record<string,PixelIconName>={components:'chip',raw_ore:'ore',refined_alloy:'ingots',volatiles:'gas',fusion_fuel:'fusion',ion_fuel:'ion'};
export function PixelIcon({name}:{name:PixelIconName}) {
  const paths:readonly string[]=shapes[name];
  return <svg className={`px-icon px-icon-${name}`} viewBox="0 0 16 16" aria-hidden="true" focusable="false" shapeRendering="crispEdges"><path fill="currentColor" d={paths[0]}/><path className="px-icon-light" d={paths[1]}/>{paths[2]&&<path className="px-icon-detail" d={paths[2]}/>}</svg>;
}
