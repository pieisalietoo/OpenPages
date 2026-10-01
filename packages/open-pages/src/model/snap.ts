export type SnapRect = {
  id?: string
  x: number
  y: number
  width: number
  height: number
}

export type SnapPage = {
  width: number
  height: number
  margins: { top: number; right: number; bottom: number; left: number }
}

export type SnapAlignGuide = {
  kind: 'align'
  orientation: 'horizontal' | 'vertical'
  position: number
  targetIds: string[]
}

export type SnapGapGuide = {
  kind: 'gap'
  orientation: 'horizontal' | 'vertical'
  size: number
  segments: Array<{ start: number; end: number; cross: number }>
  targetIds: string[]
}

export type SnapGuide = SnapAlignGuide | SnapGapGuide

export type SnapOptions = {
  enabled: boolean
  shiftKey: boolean
  threshold?: number
}

export type SnapResult = {
  x: number
  y: number
  guides: SnapGuide[]
}

export const DEFAULT_SNAP_THRESHOLD = 6

type AxisCandidate = {
  delta: number
  position: number
  guide: SnapGuide
}

type PositionTarget = {
  position: number
  targetIds: string[]
}

function overlaps1D(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && b0 < a1
}

function verticalOverlap(a: SnapRect, b: SnapRect): boolean {
  return overlaps1D(a.y, a.y + a.height, b.y, b.y + b.height)
}

function horizontalOverlap(a: SnapRect, b: SnapRect): boolean {
  return overlaps1D(a.x, a.x + a.width, b.x, b.x + b.width)
}

function midY(a: SnapRect, b: SnapRect): number {
  const top = Math.max(a.y, b.y)
  const bottom = Math.min(a.y + a.height, b.y + b.height)
  return (top + bottom) / 2
}

function midX(a: SnapRect, b: SnapRect): number {
  const left = Math.max(a.x, b.x)
  const right = Math.min(a.x + a.width, b.x + b.width)
  return (left + right) / 2
}

function idsOf(...rects: SnapRect[]): string[] {
  const ids: string[] = []
  for (const rect of rects) {
    if (rect.id && !ids.includes(rect.id)) ids.push(rect.id)
  }
  return ids
}

function xTargets(page: SnapPage, others: SnapRect[]): PositionTarget[] {
  const targets: PositionTarget[] = [
    { position: 0, targetIds: [] },
    { position: page.width, targetIds: [] },
    { position: page.width / 2, targetIds: [] },
    { position: page.margins.left, targetIds: [] },
    { position: page.width - page.margins.right, targetIds: [] },
  ]
  for (const other of others) {
    const targetIds = idsOf(other)
    targets.push(
      { position: other.x, targetIds },
      { position: other.x + other.width, targetIds },
      { position: other.x + other.width / 2, targetIds },
    )
  }
  return targets
}

function yTargets(page: SnapPage, others: SnapRect[]): PositionTarget[] {
  const targets: PositionTarget[] = [
    { position: 0, targetIds: [] },
    { position: page.height, targetIds: [] },
    { position: page.height / 2, targetIds: [] },
    { position: page.margins.top, targetIds: [] },
    { position: page.height - page.margins.bottom, targetIds: [] },
  ]
  for (const other of others) {
    const targetIds = idsOf(other)
    targets.push(
      { position: other.y, targetIds },
      { position: other.y + other.height, targetIds },
      { position: other.y + other.height / 2, targetIds },
    )
  }
  return targets
}

function bestAlignX(
  width: number,
  proposedX: number,
  targets: PositionTarget[],
  threshold: number,
): AxisCandidate | null {
  const anchors = [0, width / 2, width]
  let best: AxisCandidate | null = null
  for (const offset of anchors) {
    const current = proposedX + offset
    for (const target of targets) {
      const delta = Math.abs(current - target.position)
      if (delta > threshold) continue
      const candidate: AxisCandidate = {
        delta,
        position: target.position - offset,
        guide: {
          kind: 'align',
          orientation: 'vertical',
          position: target.position,
          targetIds: target.targetIds,
        },
      }
      best = best ? preferCandidate(best, candidate) : candidate
    }
  }
  return best
}

function bestAlignY(
  height: number,
  proposedY: number,
  targets: PositionTarget[],
  threshold: number,
): AxisCandidate | null {
  const anchors = [0, height / 2, height]
  let best: AxisCandidate | null = null
  for (const offset of anchors) {
    const current = proposedY + offset
    for (const target of targets) {
      const delta = Math.abs(current - target.position)
      if (delta > threshold) continue
      const candidate: AxisCandidate = {
        delta,
        position: target.position - offset,
        guide: {
          kind: 'align',
          orientation: 'horizontal',
          position: target.position,
          targetIds: target.targetIds,
        },
      }
      best = best ? preferCandidate(best, candidate) : candidate
    }
  }
  return best
}

function neighborGapsX(
  others: SnapRect[],
): Array<{ size: number; left: SnapRect; right: SnapRect }> {
  const sorted = [...others].sort((a, b) => a.x - b.x)
  const gaps: Array<{ size: number; left: SnapRect; right: SnapRect }> = []
  for (let i = 0; i < sorted.length; i++) {
    const left = sorted[i]
    if (!left) continue
    for (let j = i + 1; j < sorted.length; j++) {
      const right = sorted[j]
      if (!right || !verticalOverlap(left, right)) continue
      const size = right.x - (left.x + left.width)
      if (size > 0) gaps.push({ size, left, right })
      break
    }
  }
  return gaps
}

function neighborGapsY(
  others: SnapRect[],
): Array<{ size: number; top: SnapRect; bottom: SnapRect }> {
  const sorted = [...others].sort((a, b) => a.y - b.y)
  const gaps: Array<{ size: number; top: SnapRect; bottom: SnapRect }> = []
  for (let i = 0; i < sorted.length; i++) {
    const top = sorted[i]
    if (!top) continue
    for (let j = i + 1; j < sorted.length; j++) {
      const bottom = sorted[j]
      if (!bottom || !horizontalOverlap(top, bottom)) continue
      const size = bottom.y - (top.y + top.height)
      if (size > 0) gaps.push({ size, top, bottom })
      break
    }
  }
  return gaps
}

function bestGapX(
  moving: SnapRect,
  proposedX: number,
  others: SnapRect[],
  threshold: number,
): AxisCandidate | null {
  const refs = neighborGapsX(others)
  if (refs.length === 0) return null
  const proposed = { ...moving, x: proposedX }
  let best: AxisCandidate | null = null

  for (const other of others) {
    if (!verticalOverlap(proposed, other)) continue

    for (const ref of refs) {
      const rightGap = proposedX - (other.x + other.width)
      if (rightGap >= 0 && Math.abs(rightGap - ref.size) <= threshold) {
        const position = other.x + other.width + ref.size
        const candidate: AxisCandidate = {
          delta: Math.abs(rightGap - ref.size),
          position,
          guide: {
            kind: 'gap',
            orientation: 'horizontal',
            size: ref.size,
            targetIds: idsOf(ref.left, ref.right, other),
            segments: [
              {
                start: ref.left.x + ref.left.width,
                end: ref.right.x,
                cross: midY(ref.left, ref.right),
              },
              {
                start: other.x + other.width,
                end: position,
                cross: midY(other, { ...proposed, x: position }),
              },
            ],
          },
        }
        best = best ? preferCandidate(best, candidate) : candidate
      }

      const leftGap = other.x - (proposedX + moving.width)
      if (leftGap >= 0 && Math.abs(leftGap - ref.size) <= threshold) {
        const position = other.x - moving.width - ref.size
        const candidate: AxisCandidate = {
          delta: Math.abs(leftGap - ref.size),
          position,
          guide: {
            kind: 'gap',
            orientation: 'horizontal',
            size: ref.size,
            targetIds: idsOf(ref.left, ref.right, other),
            segments: [
              {
                start: ref.left.x + ref.left.width,
                end: ref.right.x,
                cross: midY(ref.left, ref.right),
              },
              {
                start: position + moving.width,
                end: other.x,
                cross: midY(other, { ...proposed, x: position }),
              },
            ],
          },
        }
        best = best ? preferCandidate(best, candidate) : candidate
      }
    }
  }
  return best
}

function bestGapY(
  moving: SnapRect,
  proposedY: number,
  others: SnapRect[],
  threshold: number,
): AxisCandidate | null {
  const refs = neighborGapsY(others)
  if (refs.length === 0) return null
  const proposed = { ...moving, y: proposedY }
  let best: AxisCandidate | null = null

  for (const other of others) {
    if (!horizontalOverlap(proposed, other)) continue

    for (const ref of refs) {
      const belowGap = proposedY - (other.y + other.height)
      if (belowGap >= 0 && Math.abs(belowGap - ref.size) <= threshold) {
        const position = other.y + other.height + ref.size
        const candidate: AxisCandidate = {
          delta: Math.abs(belowGap - ref.size),
          position,
          guide: {
            kind: 'gap',
            orientation: 'vertical',
            size: ref.size,
            targetIds: idsOf(ref.top, ref.bottom, other),
            segments: [
              {
                start: ref.top.y + ref.top.height,
                end: ref.bottom.y,
                cross: midX(ref.top, ref.bottom),
              },
              {
                start: other.y + other.height,
                end: position,
                cross: midX(other, { ...proposed, y: position }),
              },
            ],
          },
        }
        best = best ? preferCandidate(best, candidate) : candidate
      }

      const aboveGap = other.y - (proposedY + moving.height)
      if (aboveGap >= 0 && Math.abs(aboveGap - ref.size) <= threshold) {
        const position = other.y - moving.height - ref.size
        const candidate: AxisCandidate = {
          delta: Math.abs(aboveGap - ref.size),
          position,
          guide: {
            kind: 'gap',
            orientation: 'vertical',
            size: ref.size,
            targetIds: idsOf(ref.top, ref.bottom, other),
            segments: [
              {
                start: ref.top.y + ref.top.height,
                end: ref.bottom.y,
                cross: midX(ref.top, ref.bottom),
              },
              {
                start: position + moving.height,
                end: other.y,
                cross: midX(other, { ...proposed, y: position }),
              },
            ],
          },
        }
        best = best ? preferCandidate(best, candidate) : candidate
      }
    }
  }
  return best
}

function pickBest(a: AxisCandidate | null, b: AxisCandidate | null): AxisCandidate | null {
  if (!a) return b
  if (!b) return a
  return preferCandidate(a, b)
}

function preferCandidate(best: AxisCandidate, candidate: AxisCandidate): AxisCandidate {
  if (candidate.delta < best.delta) return candidate
  if (candidate.delta > best.delta) return best
  if (
    best.guide.kind === 'align' &&
    candidate.guide.kind === 'align' &&
    best.guide.position === candidate.guide.position
  ) {
    return {
      ...best,
      guide: {
        ...best.guide,
        targetIds: [...new Set([...best.guide.targetIds, ...candidate.guide.targetIds])],
      },
    }
  }
  if (candidate.guide.targetIds.length > best.guide.targetIds.length) return candidate
  return best
}

export function snapSectionPosition(
  moving: SnapRect,
  proposed: { x: number; y: number },
  others: SnapRect[],
  page: SnapPage,
  options: SnapOptions,
): SnapResult {
  if (!options.enabled || options.shiftKey) {
    return { x: proposed.x, y: proposed.y, guides: [] }
  }

  const threshold = options.threshold ?? DEFAULT_SNAP_THRESHOLD
  const xBest = pickBest(
    bestAlignX(moving.width, proposed.x, xTargets(page, others), threshold),
    bestGapX(moving, proposed.x, others, threshold),
  )
  const yBest = pickBest(
    bestAlignY(moving.height, proposed.y, yTargets(page, others), threshold),
    bestGapY(moving, proposed.y, others, threshold),
  )

  const guides: SnapGuide[] = []
  if (xBest) guides.push(xBest.guide)
  if (yBest) guides.push(yBest.guide)

  return {
    x: xBest?.position ?? proposed.x,
    y: yBest?.position ?? proposed.y,
    guides,
  }
}

type SizeCandidate = {
  delta: number
  size: number
  guide: SnapAlignGuide
}

function preferSize(best: SizeCandidate, candidate: SizeCandidate): SizeCandidate {
  if (candidate.delta < best.delta) return candidate
  if (candidate.delta > best.delta) return best
  if (candidate.guide.position === best.guide.position) {
    return {
      delta: best.delta,
      size: best.size,
      guide: {
        kind: 'align',
        orientation: best.guide.orientation,
        position: best.guide.position,
        targetIds: [...new Set([...best.guide.targetIds, ...candidate.guide.targetIds])],
      },
    }
  }
  if (candidate.guide.targetIds.length > best.guide.targetIds.length) return candidate
  return best
}

function bestResizeAxis(
  origin: number,
  proposedSize: number,
  targets: PositionTarget[],
  threshold: number,
  orientation: 'horizontal' | 'vertical',
): SizeCandidate | null {
  const samples = [
    { at: origin + proposedSize, sizeFor: (target: number) => target - origin },
    { at: origin + proposedSize / 2, sizeFor: (target: number) => (target - origin) * 2 },
  ]
  let best: SizeCandidate | null = null
  for (const sample of samples) {
    for (const target of targets) {
      const delta = Math.abs(sample.at - target.position)
      if (delta > threshold) continue
      const size = sample.sizeFor(target.position)
      if (size < 1) continue
      const candidate: SizeCandidate = {
        delta,
        size,
        guide: {
          kind: 'align',
          orientation,
          position: target.position,
          targetIds: target.targetIds,
        },
      }
      best = best ? preferSize(best, candidate) : candidate
    }
  }
  return best
}

export function snapSectionSize(
  anchor: { x: number; y: number },
  proposed: { width: number; height: number },
  others: SnapRect[],
  page: SnapPage,
  options: SnapOptions,
): { width: number; height: number; guides: SnapGuide[] } {
  const box = snapSectionBox(
    { x: anchor.x, y: anchor.y, width: proposed.width, height: proposed.height },
    { left: true, top: true, right: false, bottom: false },
    others,
    page,
    options,
  )
  return { width: box.width, height: box.height, guides: box.guides }
}

type EdgeLocks = { left: boolean; top: boolean; right: boolean; bottom: boolean }

type EdgeCandidate = {
  delta: number
  moving: number
  size: number
  guide: SnapAlignGuide
}

function preferEdge(best: EdgeCandidate, candidate: EdgeCandidate): EdgeCandidate {
  if (candidate.delta < best.delta) return candidate
  if (candidate.delta > best.delta) return best
  if (candidate.guide.position === best.guide.position) {
    return {
      delta: best.delta,
      moving: best.moving,
      size: best.size,
      guide: {
        kind: 'align',
        orientation: best.guide.orientation,
        position: best.guide.position,
        targetIds: [...new Set([...best.guide.targetIds, ...candidate.guide.targetIds])],
      },
    }
  }
  if (candidate.guide.targetIds.length > best.guide.targetIds.length) return candidate
  return best
}

/** Snap a free edge toward `fixed`, keeping the fixed edge in place. */
function bestEdgeAgainstFixed(
  fixed: number,
  moving: number,
  targets: PositionTarget[],
  threshold: number,
  orientation: 'horizontal' | 'vertical',
): EdgeCandidate | null {
  const samples = [
    { at: moving, movingFor: (target: number) => target },
    { at: (moving + fixed) / 2, movingFor: (target: number) => 2 * target - fixed },
  ]
  let best: EdgeCandidate | null = null
  for (const sample of samples) {
    for (const target of targets) {
      const delta = Math.abs(sample.at - target.position)
      if (delta > threshold) continue
      const nextMoving = sample.movingFor(target.position)
      const size = Math.abs(fixed - nextMoving)
      if (size < 1) continue
      const candidate: EdgeCandidate = {
        delta,
        moving: nextMoving,
        size,
        guide: {
          kind: 'align',
          orientation,
          position: target.position,
          targetIds: target.targetIds,
        },
      }
      best = best ? preferEdge(best, candidate) : candidate
    }
  }
  return best
}

export function snapSectionBox(
  proposed: { x: number; y: number; width: number; height: number },
  locks: EdgeLocks,
  others: SnapRect[],
  page: SnapPage,
  options: SnapOptions,
): { x: number; y: number; width: number; height: number; guides: SnapGuide[] } {
  if (!options.enabled || options.shiftKey) {
    return { ...proposed, guides: [] }
  }

  const threshold = options.threshold ?? DEFAULT_SNAP_THRESHOLD
  let { x, y, width, height } = proposed
  const guides: SnapGuide[] = []

  if (locks.left && !locks.right) {
    const xBest = bestResizeAxis(x, width, xTargets(page, others), threshold, 'vertical')
    if (xBest) {
      width = xBest.size
      guides.push(xBest.guide)
    }
  } else if (!locks.left && locks.right) {
    const right = x + width
    const xBest = bestEdgeAgainstFixed(right, x, xTargets(page, others), threshold, 'vertical')
    if (xBest) {
      x = Math.min(xBest.moving, right - 1)
      width = right - x
      guides.push(xBest.guide)
    }
  }

  if (locks.top && !locks.bottom) {
    const yBest = bestResizeAxis(y, height, yTargets(page, others), threshold, 'horizontal')
    if (yBest) {
      height = yBest.size
      guides.push(yBest.guide)
    }
  } else if (!locks.top && locks.bottom) {
    const bottom = y + height
    const yBest = bestEdgeAgainstFixed(bottom, y, yTargets(page, others), threshold, 'horizontal')
    if (yBest) {
      y = Math.min(yBest.moving, bottom - 1)
      height = bottom - y
      guides.push(yBest.guide)
    }
  }

  return { x, y, width: Math.max(1, width), height: Math.max(1, height), guides }
}

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export function resizeHandleLocks(handle: ResizeHandle): EdgeLocks {
  return {
    left: handle !== 'w' && !handle.includes('w'),
    right: handle !== 'e' && !handle.includes('e'),
    top: handle !== 'n' && !handle.includes('n'),
    bottom: handle !== 's' && !handle.includes('s'),
  }
}

export function proposedBoxForResizeHandle(
  origin: { x: number; y: number; width: number; height: number },
  dx: number,
  dy: number,
  handle: ResizeHandle,
): { x: number; y: number; width: number; height: number } {
  let { x, y, width, height } = origin
  const right = x + width
  const bottom = y + height
  if (handle.includes('e') || handle === 'e') {
    width = Math.max(1, origin.width + dx)
  }
  if (handle.includes('w') || handle === 'w') {
    x = Math.min(origin.x + dx, right - 1)
    width = right - x
  }
  if (handle.includes('s') || handle === 's') {
    height = Math.max(1, origin.height + dy)
  }
  if (handle.includes('n') || handle === 'n') {
    y = Math.min(origin.y + dy, bottom - 1)
    height = bottom - y
  }
  return { x, y, width, height }
}
