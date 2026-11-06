import { createContext } from 'react';
export const PixelTheme = createContext(false);
// Filled shapes on an integer 16px grid; labels belong to the surrounding control.
const shapes = {
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
export function PixelIcon({name}:{name:PixelIconName}) {
  return <svg className={`px-icon px-icon-${name}`} viewBox="0 0 16 16" aria-hidden="true" focusable="false" shapeRendering="crispEdges"><path fill="currentColor" d={shapes[name][0]}/><path className="px-icon-light" d={shapes[name][1]}/></svg>;
}
