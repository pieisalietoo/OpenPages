/** Scale factor so a line's ink spans the full slot width (scaleX / font-stretch). */
export function horizontalStretchScale(contentWidth: number, lineWidth: number): number {
  if (!(contentWidth > 0) || !(lineWidth > 0)) return 1
  return lineWidth / contentWidth
}
