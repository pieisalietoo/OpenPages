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
