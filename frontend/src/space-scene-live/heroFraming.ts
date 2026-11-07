export type HeroInsets = { top: number; bottom: number };

/** Fit the approved scene into the hero space left by real HTML overlays. */
export function heroFrustum(width: number, height: number, insets: HeroInsets, shipVisible: boolean) {
  if (![width, height, insets.top, insets.bottom].every(Number.isFinite) || width <= 0 || height <= 0) throw new RangeError('Invalid hero viewport');
  const top = Math.max(0, insets.top), bottom = Math.max(0, insets.bottom);
  const availableHeight = Math.max(80, height - top - bottom);
  const unitsPerPixel = Math.max(3.1 / availableHeight, (shipVisible ? 4.3 : 3.1) / width);
  const halfWidth = width * unitsPerPixel / 2, halfHeight = height * unitsPerPixel / 2;
  const centerX = shipVisible ? -0.55 : 0, centerY = (top - bottom) * unitsPerPixel / 2;
  return { left: centerX - halfWidth, right: centerX + halfWidth, top: centerY + halfHeight, bottom: centerY - halfHeight };
}

/** Screen-space guide stays centered on the projected origin and inside its host. */
export function planetGuideFrame(width: number, height: number, frame: { left: number; right: number; top: number; bottom: number; zoom: number }, radius: number) {
  const scale = height / (frame.top - frame.bottom) * frame.zoom;
  const x = width / 2 - (frame.left + frame.right) / 2 * scale;
  const y = height / 2 + (frame.top + frame.bottom) / 2 * scale;
  const r = Math.max(0, Math.min(radius * scale, x - 8, width - x - 8, y - 8, height - y - 8));
  return { left: x - r, top: y - r, size: r * 2 };
}
