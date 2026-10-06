// D047: pure viewport clamp; no world state and no layout reads during a drag.
// top/bottom are the cached free strip between HUD + notices and the build dock.
export function costTagPosition(x: number, y: number, width: number, height: number, viewportWidth: number, viewportHeight: number, top: number, bottom: number): { left: number; top: number } | null {
  const margin = 8, lo = Math.max(margin, top), hi = Math.min(viewportHeight - margin, bottom) - height;
  if (width > viewportWidth - 2 * margin || hi < lo) return null;
  return {
    left: Math.max(margin + width / 2, Math.min(viewportWidth - margin - width / 2, x)),
    top: Math.max(lo, Math.min(hi, y - height - 12)),
  };
}
