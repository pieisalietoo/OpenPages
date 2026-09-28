import type { InlineRun } from './inline-runs'

export interface TextMeasureStyle {
  fontFamily: string
  fontSize: number
  fontBold?: boolean
  fontItalic?: boolean
}

export type MeasureFn = (text: string, style: TextMeasureStyle) => number

function styleForRun(run: InlineRun, base: TextMeasureStyle): TextMeasureStyle {
  return {
    fontFamily: run.fontFamily ?? base.fontFamily,
    fontSize: run.fontSize ?? base.fontSize,
    fontBold: run.bold ?? base.fontBold,
    fontItalic: run.italic ?? base.fontItalic,
  }
}

/**
 * Width of `text[0..end)` using per-run font metrics when `runs` are present
 * (concat of run.text should match `text`). Falls back to a uniform `base` style.
 */
export function measurePlainPrefix(
  text: string,
  end: number,
  measure: MeasureFn,
  base: TextMeasureStyle,
  runs?: InlineRun[],
): number {
  const clamped = Math.max(0, Math.min(end, text.length))
  if (clamped <= 0) return 0
  if (!runs?.length) return measure(text.slice(0, clamped), base)

  let width = 0
  let pos = 0
  for (const run of runs) {
    const rs = pos
    const re = pos + run.text.length
    pos = re
    if (rs >= clamped) break
    const to = Math.min(clamped, re)
    if (to <= rs) continue
    width += measure(run.text.slice(0, to - rs), styleForRun(run, base))
  }
  if (pos < clamped) width += measure(text.slice(pos, clamped), base)
  return width
}

/** Deterministic measurer for tests: width = text.length * fontSize * em. */
export function createFixedMeasurer(em = 0.5): MeasureFn {
  return (text, style) => text.length * style.fontSize * em
}

export function createCanvasMeasurer(): MeasureFn {
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  return (text, style) => {
    if (typeof document === 'undefined') {
      return createFixedMeasurer(0.5)(text, style)
    }
    if (!canvas) {
      canvas = document.createElement('canvas')
      ctx = canvas.getContext('2d')
    }
    if (!ctx) return createFixedMeasurer(0.5)(text, style)
    const weight = style.fontBold ? '700' : '400'
    const italic = style.fontItalic ? 'italic ' : ''
    ctx.font = `${italic}${weight} ${style.fontSize}px ${style.fontFamily}`
    return ctx.measureText(text).width
  }
}
