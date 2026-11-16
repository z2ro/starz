/**
 * The one 48-colour palette every pixel pipeline snaps to (planet globe, ships, orbital scenes, colony surface).
 * Ramps shift hue as well as value: shadows lean violet, highlights lean yellow. Besides the navy/teal base it
 * carries a warm ramp, a steel ramp for hulls and a single stone ramp instead of scattered greys.
 * Index 22 and the last two entries are overridden by the orbital star palette; keep expendable colours there.
 */
export const PIXEL_PALETTE = [
  '#0c1224', '#111a33', '#16294a', '#1b4060', '#1a5a78', '#1f7d92', '#3aa3a8', '#7fcfc4',
  '#b59a5e', '#f4fbe8', '#142a2e', '#1c4a3c', '#2c6b3f', '#4b8743', '#5f8a4c', '#78a04a',
  '#a9c466', '#2a1a2e', '#8c7648', '#7a4638', '#a8683c', '#cf9450', '#4e3875', '#e8c170',
  '#f7e6a8', '#5c1f2e', '#9c3a2e', '#d9632b', '#f29a38', '#ffd166', '#8a6fd1', '#c9b6f2',
  '#2a3340', '#4a5a68', '#8d8b8a', '#b3c4c9', '#6b6a6e', '#b0aca4', '#d9d2bc', '#5aa9d6',
  '#9fd4ea', '#d6eff5', '#ffffff', '#3d5a78', '#6f8fae', '#a9c0d4', '#b8324a', '#f06a6a',
];
