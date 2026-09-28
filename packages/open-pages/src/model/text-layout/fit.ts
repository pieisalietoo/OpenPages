import type { Rect } from '../runaround'
import type { InlineRun } from './inline-runs'
import { type LaidOutLine, type LayoutTextFrameResult, layoutTextFrame } from './layout'
import type { MeasureFn } from './measure'

export type TextFitMode = 'none' | 'fill'

export interface FitTextFrameInput {
  text: string
  host: Rect
  columnCount: number
  columnGap: number
  fontSize: number
  lineHeight: number
  fontFamily?: string
  fontBold?: boolean
  fontItalic?: boolean
  exclusions: Rect[]
  measure: MeasureFn
  mode: TextFitMode
  minScale?: number
  maxScale?: number
  inlineRuns?: InlineRun[]
}

export interface FitTextFrameResult extends LayoutTextFrameResult {
  fontSize: number
  lineHeight: number
}

function layoutAtScale(input: FitTextFrameInput, scale: number) {
  return layoutTextFrame({
    ...input,
    fontSize: Math.max(1, input.fontSize * scale),
  })
}

/** Scale fontSize so laid-out text fills the frame height as closely as possible without overflowing. */
export function fitTextFrame(input: FitTextFrameInput): FitTextFrameResult {
  if (input.mode === 'none') {
    const laid = layoutTextFrame(input)
    return {
      ...laid,
      fontSize: input.fontSize,
      lineHeight: input.lineHeight,
    }
  }

  const minScale = input.minScale ?? 0.25
  const maxScale = input.maxScale ?? 8
  let lo = minScale
  let hi = maxScale
  let best = layoutAtScale(input, minScale)
  let bestScale = minScale

  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2
    const laid = layoutAtScale(input, mid)
    if (!laid.overflow && laid.contentBottom <= input.host.height + 0.5) {
      best = laid
      bestScale = mid
      lo = mid
    } else {
      hi = mid
    }
  }

  return {
    ...best,
    fontSize: Math.max(1, input.fontSize * bestScale),
    lineHeight: input.lineHeight,
  }
}

export type { LaidOutLine }
