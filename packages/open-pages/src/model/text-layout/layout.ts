import type { Rect } from '../runaround'
import { iterLineSlots, type LineSlot } from './geometry'
import { type InlineRun, sliceInlineRuns } from './inline-runs'
import { type MeasureFn, measurePlainPrefix, type TextMeasureStyle } from './measure'

export interface LaidOutLine {
  text: string
  x: number
  y: number
  width: number
  height: number
  columnIndex: number
  /** Relative to the frame's base fontSize (headings > 1). */
  fontScale?: number
  fontBold?: boolean
  fontItalic?: boolean
  /**
   * Half-open range into model plain text (`plainTextOf` / textContent).
   * Hit-test and editing use these — not a separate layout-only index space.
   */
  modelStart: number
  modelEnd: number
  /** Visual-only list prefix (not part of model plain / line.text). */
  listMarker?: string
  /** Optional inline paint runs; concat === text when present. */
  runs?: InlineRun[]
}

export interface LayoutTextFrameInput {
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
  /** Optional inline paint runs; when set, wrap width uses per-run font metrics. */
  inlineRuns?: InlineRun[]
}

export interface LayoutTextFrameResult {
  lines: LaidOutLine[]
  overflow: boolean
  contentBottom: number
}

interface BlockStyle {
  fontScale: number
  fontBold?: boolean
  fontItalic?: boolean
}

function styleForTag(tag: string): BlockStyle {
  switch (tag) {
    case 'h1':
      return { fontScale: 2, fontBold: true }
    case 'h2':
      return { fontScale: 1.5, fontBold: true }
    case 'h3':
      return { fontScale: 1.25, fontBold: true }
    case 'h4':
      return { fontScale: 1.125, fontBold: true }
    case 'h5':
      return { fontScale: 1, fontBold: true }
    case 'h6':
      return { fontScale: 0.9, fontBold: true }
    case 'blockquote':
      return { fontScale: 1, fontItalic: true }
    default:
      return { fontScale: 1 }
  }
}

function bandsForScale(scale: number): number {
  return Math.max(1, Math.ceil(scale - 0.001))
}

function tokenize(text: string): string[] {
  const tokens: string[] = []
  // Keep / style / list markers first so they are never glued onto the following word.
  const re = /\uE000\d+\uE001|\uE010[a-z0-9]+\uE011|\uE020[uo]\d*\uE021|\n|[^\s\n]+|[^\S\n]+/g
  let m = re.exec(text)
  while (m !== null) {
    tokens.push(m[0])
    m = re.exec(text)
  }
  return tokens
}

function parseKeepToken(tok: string | undefined): number | null {
  if (!tok) return null
  const m = /^\uE000(\d+)\uE001$/.exec(tok)
  if (!m) return null
  const n = Number.parseInt(m[1] ?? '', 10)
  return Number.isFinite(n) && n > 0 ? Math.min(99, n) : null
}

function parseStyleToken(tok: string | undefined): string | null {
  if (!tok) return null
  const m = /^\uE010([a-z0-9]+)\uE011$/.exec(tok)
  return m?.[1] ?? null
}

function parseListMarkerToken(tok: string | undefined): string | null {
  if (!tok) return null
  const m = /^\uE020(?:u|o(\d+))\uE021$/.exec(tok)
  if (!m) return null
  return m[1] != null ? `${m[1]}. ` : '• '
}

function isControlToken(tok: string | undefined): boolean {
  if (!tok || tok === '\n') return true
  return (
    parseKeepToken(tok) !== null ||
    parseStyleToken(tok) !== null ||
    parseListMarkerToken(tok) !== null
  )
}

function slotsLeftInColumn(slots: LineSlot[], si: number): number {
  if (si >= slots.length) return 0
  const col = slots[si]?.columnIndex
  if (col === undefined) return 0
  let n = 0
  for (let i = si; i < slots.length && slots[i]?.columnIndex === col; i++) n++
  return n
}

function advanceToNextColumn(slots: LineSlot[], si: number): number {
  if (si >= slots.length) return si
  const col = slots[si]?.columnIndex
  if (col === undefined) return si
  let i = si
  while (i < slots.length && slots[i]?.columnIndex === col) i++
  return i
}

function fillSlot(
  slot: LineSlot,
  tokens: string[],
  start: number,
  style: TextMeasureStyle,
  measure: MeasureFn,
  runsAt?: (from: number, to: number) => InlineRun[] | undefined,
  plainStart = 0,
): { text: string; next: number; skippedSpaces: string } {
  let i = start
  // Soft-wrap / indent spaces must stay in the model even when they are not
  // painted at the start of a line — otherwise model offsets drift vs plainTextOf.
  let skippedSpaces = ''
  while (i < tokens.length) {
    const lead = tokens[i]
    if (lead === undefined || isControlToken(lead) || !/^\s+$/.test(lead)) break
    skippedSpaces += lead
    i++
  }
  if (i >= tokens.length) return { text: '', next: i, skippedSpaces }
  if (isControlToken(tokens[i])) return { text: '', next: i, skippedSpaces }

  const widthOf = (s: string) =>
    measurePlainPrefix(s, s.length, measure, style, runsAt?.(plainStart, plainStart + s.length))

  let text = ''
  while (i < tokens.length) {
    const tok = tokens[i]
    if (tok === undefined || isControlToken(tok)) break
    const nextWidth = widthOf(text + tok)
    if (text && nextWidth > slot.width + 0.01) break
    if (!text && widthOf(tok) > slot.width + 0.01) {
      let slice = ''
      for (const ch of tok) {
        if (widthOf(slice + ch) > slot.width + 0.01 && slice) break
        slice += ch
      }
      if (!slice) slice = tok[0] ?? ''
      const rest = tok.slice(slice.length)
      tokens.splice(i, 1, ...(rest ? [slice, rest] : [slice]))
      text = slice
      i++
      break
    }
    text += tok
    i++
  }
  return { text, next: i, skippedSpaces }
}

export function layoutTextFrame(input: LayoutTextFrameInput): LayoutTextFrameResult {
  const lineHeightPx = Math.max(1, input.fontSize * input.lineHeight)
  const baseStyle: TextMeasureStyle = {
    fontFamily: input.fontFamily ?? 'Georgia, serif',
    fontSize: input.fontSize,
    fontBold: input.fontBold,
    fontItalic: input.fontItalic,
  }
  const slots = iterLineSlots({
    host: input.host,
    columnCount: input.columnCount,
    columnGap: input.columnGap,
    lineHeightPx,
    exclusions: input.exclusions,
  })
  const tokens = tokenize(input.text.replace(/\r\n/g, '\n'))
  const lines: LaidOutLine[] = []
  let ti = 0
  let si = 0
  let keepMin = 0
  let keepStartTi = 0
  let keepLineStart = 0
  let blockStyle: BlockStyle | null = null
  let pendingListMarker: string | null = null
  let emittedPlain = 0
  const inlineRuns = input.inlineRuns
  const runsAt = inlineRuns?.length
    ? (from: number, to: number) => sliceInlineRuns(inlineRuns, from, to)
    : undefined

  while (ti < tokens.length && si < slots.length) {
    const keepN = parseKeepToken(tokens[ti])
    if (keepN !== null) {
      keepMin = keepN
      keepStartTi = ti + 1
      keepLineStart = lines.length
      ti++
      continue
    }

    const styleTag = parseStyleToken(tokens[ti])
    if (styleTag !== null) {
      blockStyle = styleForTag(styleTag)
      ti++
      continue
    }

    const listMk = parseListMarkerToken(tokens[ti])
    if (listMk !== null) {
      pendingListMarker = listMk
      ti++
      continue
    }

    if (tokens[ti] === '\n') {
      keepMin = 0
      blockStyle = null
      pendingListMarker = null
      ti++
      const cur = slots[si]
      if (cur) {
        while (
          si < slots.length &&
          slots[si]?.y === cur.y &&
          slots[si]?.columnIndex === cur.columnIndex
        ) {
          si++
        }
      }
      continue
    }

    const active = blockStyle ?? { fontScale: 1 }
    const bands = bandsForScale(active.fontScale)
    const needSlots = bands + (keepMin > 0 ? keepMin : 0)
    while (slotsLeftInColumn(slots, si) < needSlots && si < slots.length) {
      const nextCol = advanceToNextColumn(slots, si)
      if (nextCol === si) break
      si = nextCol
    }

    const slot = slots[si]
    if (!slot) break
    const measureStyle: TextMeasureStyle = {
      ...baseStyle,
      fontSize: input.fontSize * active.fontScale,
      fontBold: active.fontBold ?? baseStyle.fontBold,
      fontItalic: active.fontItalic ?? baseStyle.fontItalic,
    }
    // Soft-wrap spaces that attach to the previous line are not part of this
    // slot's visible text — measure runs from after those spaces.
    const skipLead = (() => {
      let j = ti
      let spaces = ''
      while (j < tokens.length) {
        const lead = tokens[j]
        if (lead === undefined || isControlToken(lead) || !/^\s+$/.test(lead)) break
        spaces += lead
        j++
      }
      return lines.length > 0 ? spaces.length : 0
    })()
    const { text, next, skippedSpaces } = fillSlot(
      slot,
      tokens,
      ti,
      measureStyle,
      input.measure,
      runsAt,
      emittedPlain + skipLead,
    )
    if (next === ti) {
      si++
      continue
    }
    // Soft-wrap spaces skipped at the start of this slot still belong in the
    // model: attach them to the previous line (trailing EOL) so
    // concat(line.text) === plainTextOf. First-line leading spaces stay here.
    const lineText = skippedSpaces && lines.length === 0 ? skippedSpaces + text : text
    if (skippedSpaces && lines.length > 0) {
      const prev = lines[lines.length - 1]
      if (prev) {
        prev.text += skippedSpaces
        emittedPlain += skippedSpaces.length
      }
    }
    if (lineText) {
      const endsKeep = keepMin > 0 && (next >= tokens.length || tokens[next] === '\n')
      if (endsKeep && slotsLeftInColumn(slots, si) < bands + keepMin) {
        const nextCol = advanceToNextColumn(slots, si)
        if (nextCol > si && nextCol < slots.length) {
          lines.length = keepLineStart
          ti = keepStartTi
          si = nextCol
          blockStyle = null
          emittedPlain = lines.reduce((n, l) => n + l.text.length, 0)
          continue
        }
      }
      const listMarker = pendingListMarker ?? undefined
      pendingListMarker = null
      lines.push({
        text: lineText,
        x: slot.x,
        y: slot.y,
        width: slot.width,
        height: lineHeightPx * bands,
        columnIndex: slot.columnIndex,
        fontScale: active.fontScale,
        fontBold: active.fontBold ?? baseStyle.fontBold,
        fontItalic: active.fontItalic ?? baseStyle.fontItalic,
        modelStart: 0,
        modelEnd: 0,
        listMarker,
      })
      emittedPlain += lineText.length
      if (endsKeep) keepMin = 0
    }
    ti = next
    // Consume a trailing hard break here so we don't advance an extra band afterward.
    if (ti < tokens.length && tokens[ti] === '\n') {
      keepMin = 0
      blockStyle = null
      pendingListMarker = null
      ti++
    }
    si += bands
  }

  let modelPos = 0
  for (const line of lines) {
    line.modelStart = modelPos
    line.modelEnd = modelPos + line.text.length
    if (input.inlineRuns?.length) {
      line.runs = sliceInlineRuns(input.inlineRuns, line.modelStart, line.modelEnd)
    }
    modelPos = line.modelEnd
  }

  const overflow = ti < tokens.length
  const contentBottom =
    lines.length === 0 ? 0 : Math.max(...lines.map((l) => l.y + l.height - input.host.y))
  return { lines, overflow, contentBottom }
}
