/** Rectangular runaround exclusions (page-space); text wrap uses the line-box engine. */

export const DEFAULT_WRAP_OFFSET = 8

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface RunaroundZoneRect extends Rect {
  id: string
  wrapOffset?: number
  hidden?: boolean
}

export interface RelativeExclusion {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export function inflateRect(rect: Rect, pad: number): Rect {
  return {
    x: rect.x - pad,
    y: rect.y - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  }
}

export function intersectRects(a: Rect, b: Rect): Rect | null {
  const left = Math.max(a.x, b.x)
  const top = Math.max(a.y, b.y)
  const right = Math.min(a.x + a.width, b.x + b.width)
  const bottom = Math.min(a.y + a.height, b.y + b.height)
  if (right <= left || bottom <= top) return null
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/** Map page-space runaround zones into host-local exclusion boxes (sorted top→bottom). */
export function relativeExclusionsForHost(
  host: Rect,
  zones: RunaroundZoneRect[],
): RelativeExclusion[] {
  const result: RelativeExclusion[] = []
  for (const zone of zones) {
    if (zone.hidden) continue
    const pad = zone.wrapOffset ?? DEFAULT_WRAP_OFFSET
    const hit = intersectRects(host, inflateRect(zone, pad))
    if (!hit || hit.width < 1 || hit.height < 1) continue
    result.push({
      id: zone.id,
      x: hit.x - host.x,
      y: hit.y - host.y,
      width: hit.width,
      height: hit.height,
    })
  }
  return result.sort((a, b) => a.y - b.y || a.x - b.x)
}

type RunaroundSource = {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  hidden?: boolean
  runaround?: boolean
  wrapOffset?: number
}

export function sectionActsAsRunaround(section: RunaroundSource): boolean {
  return section.type === 'runaround' || section.runaround === true
}

/** Zones that wrap text for `hostId`, excluding the host itself. */
export function runaroundZonesForHost(
  sections: RunaroundSource[],
  hostId: string,
): RunaroundZoneRect[] {
  return sections
    .filter((section) => section.id !== hostId && sectionActsAsRunaround(section))
    .map((section) => ({
      id: section.id,
      x: section.x,
      y: section.y,
      width: section.width,
      height: section.height,
      hidden: section.hidden,
      wrapOffset:
        section.type === 'runaround' && typeof section.wrapOffset === 'number'
          ? section.wrapOffset
          : DEFAULT_WRAP_OFFSET,
    }))
}
