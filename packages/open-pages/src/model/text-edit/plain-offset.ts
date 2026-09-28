/**
 * Mutate HTML content by plain-text offsets (textContent order via DOM).
 * Used by live layout WYSIWYG editing.
 */

function parseHtml(html: string): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = html || ''
  return root
}

function serializeHtml(root: HTMLElement): string {
  return root.innerHTML
}

/** Visible plain length (text nodes only, as textContent). */
export function plainTextLength(html: string): number {
  return parseHtml(html).textContent?.length ?? 0
}

export function plainTextOf(html: string): string {
  return parseHtml(html).textContent ?? ''
}

function isWordChar(ch: string): boolean {
  return /[\p{L}\p{N}_]/u.test(ch)
}

/** Expand plain offset to the surrounding word; on whitespace prefers the nearest word. */
export function wordRangeAtOffset(text: string, offset: number): { start: number; end: number } {
  const len = text.length
  const clamped = Math.max(0, Math.min(offset, len))
  if (len === 0) return { start: 0, end: 0 }
  let probe = clamped
  if (probe >= len) {
    if (probe > 0 && isWordChar(text[probe - 1]!)) probe = probe - 1
    else return { start: clamped, end: clamped }
  } else if (!isWordChar(text[probe]!)) {
    let left = probe - 1
    while (left >= 0 && !isWordChar(text[left]!)) left -= 1
    if (left >= 0) {
      probe = left
    } else {
      let right = probe + 1
      while (right < len && !isWordChar(text[right]!)) right += 1
      if (right >= len) return { start: clamped, end: clamped }
      probe = right
    }
  }
  let start = probe
  let end = probe + 1
  while (start > 0 && isWordChar(text[start - 1]!)) start -= 1
  while (end < len && isWordChar(text[end]!)) end += 1
  return { start, end }
}

interface TextPoint {
  node: Text
  offset: number
}

function textPointAt(root: HTMLElement, plainOffset: number): TextPoint | null {
  const clamped = Math.max(0, plainOffset)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let remaining = clamped
  let node = walker.nextNode() as Text | null
  let last: TextPoint | null = null
  while (node) {
    const len = node.data.length
    last = { node, offset: len }
    if (remaining <= len) {
      return { node, offset: remaining }
    }
    remaining -= len
    node = walker.nextNode() as Text | null
  }
  if (last) return last
  // Empty root: create a text node so callers can insert.
  const text = document.createTextNode('')
  root.appendChild(text)
  return { node: text, offset: 0 }
}

export function insertPlainText(html: string, offset: number, text: string): string {
  if (!text) return html
  const root = parseHtml(html)
  const point = textPointAt(root, offset)
  if (!point) {
    root.appendChild(document.createTextNode(text))
    return serializeHtml(root)
  }
  point.node.insertData(point.offset, text)
  return serializeHtml(root)
}

export function deletePlainRange(html: string, start: number, end: number): string {
  const from = Math.max(0, Math.min(start, end))
  const to = Math.max(0, Math.max(start, end))
  if (to <= from) return html
  const root = parseHtml(html)
  const plain = root.textContent ?? ''
  if (!plain.length) return html

  // Rebuild by slicing textContent is wrong for markup. Delete across text nodes.
  let pos = 0
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let n = walker.nextNode() as Text | null
  while (n) {
    nodes.push(n)
    n = walker.nextNode() as Text | null
  }
  for (const node of nodes) {
    const len = node.data.length
    const nodeStart = pos
    const nodeEnd = pos + len
    pos = nodeEnd
    if (nodeEnd <= from || nodeStart >= to) continue
    const cutStart = Math.max(0, from - nodeStart)
    const cutEnd = Math.min(len, to - nodeStart)
    node.deleteData(cutStart, cutEnd - cutStart)
  }
  return serializeHtml(root)
}

/** Place a caret/selection inside `root` by plain-text offsets (textContent order). */
export function setDomSelectionFromPlainOffsets(
  root: HTMLElement,
  anchor: number,
  focus: number,
): void {
  const doc = root.ownerDocument
  if (!doc) return
  const start = textPointAt(root, anchor)
  const end = textPointAt(root, focus)
  if (!start || !end) return
  const range = doc.createRange()
  if (anchor <= focus) {
    range.setStart(start.node, start.offset)
    range.setEnd(end.node, end.offset)
  } else {
    range.setStart(end.node, end.offset)
    range.setEnd(start.node, start.offset)
  }
  const sel = doc.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}
