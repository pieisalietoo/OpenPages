export type InlineTextStyle = {
  fontFamily?: string
  fontSize?: number
  lineHeight?: number
  color?: string
}

/** Returns the current non-collapsed selection range when it lies inside `root`. */
export function getEditableSelectionRange(root: HTMLElement): Range | null {
  const sel = root.ownerDocument.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null
  const range = sel.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return null
  return range
}

function reselectNode(node: Node) {
  const doc = node.ownerDocument
  if (!doc) return
  const sel = doc.getSelection()
  if (!sel) return
  const next = doc.createRange()
  next.selectNodeContents(node)
  sel.removeAllRanges()
  sel.addRange(next)
}

/** Wraps a concrete range in a styled span. Returns the wrapper span, or null. */
export function applyInlineStyleToRange(
  range: Range,
  style: InlineTextStyle,
  options?: { reselect?: boolean },
): HTMLElement | null {
  if (range.collapsed) return null
  const doc = range.commonAncestorContainer.ownerDocument
  if (!doc) return null

  // Prefer mutating a span that already covers the range exactly — nesting a new
  // font-size outside an inner font-size leaves paint stuck on the inner value.
  const ancestor = range.commonAncestorContainer
  const existing =
    ancestor.nodeType === Node.ELEMENT_NODE ? (ancestor as HTMLElement) : ancestor.parentElement
  if (existing && existing.tagName === 'SPAN' && range.toString() === existing.textContent) {
    applyInlineStyleToElement(existing, style)
    if (options?.reselect !== false) reselectNode(existing)
    return existing
  }

  const span = doc.createElement('span')
  if (style.fontFamily !== undefined) span.style.fontFamily = style.fontFamily
  if (style.fontSize !== undefined) span.style.fontSize = `${Math.max(1, style.fontSize)}px`
  if (style.lineHeight !== undefined) {
    span.style.lineHeight = String(Math.max(0.5, style.lineHeight))
  }
  if (style.color !== undefined) span.style.color = style.color

  try {
    range.surroundContents(span)
  } catch {
    const contents = range.extractContents()
    span.appendChild(contents)
    range.insertNode(span)
  }
  if (style.fontSize !== undefined || style.fontFamily !== undefined) {
    for (const node of Array.from(span.querySelectorAll('span'))) {
      if (!(node instanceof HTMLElement) || node === span) continue
      if (style.fontSize !== undefined && node.style.fontSize) node.style.fontSize = ''
      if (style.fontFamily !== undefined && node.style.fontFamily) node.style.fontFamily = ''
    }
  }
  if (options?.reselect !== false) reselectNode(span)
  return span
}

/** Applies inline styles onto an existing element (no extra wrapper). */
export function applyInlineStyleToElement(el: HTMLElement, style: InlineTextStyle): void {
  if (style.fontFamily !== undefined) el.style.fontFamily = style.fontFamily
  if (style.fontSize !== undefined) el.style.fontSize = `${Math.max(1, style.fontSize)}px`
  if (style.lineHeight !== undefined) {
    el.style.lineHeight = String(Math.max(0.5, style.lineHeight))
  }
  if (style.color !== undefined) el.style.color = style.color
}

/** Wraps the current selection in a styled span. Returns false when there is no range. */
export function applyInlineStyleToSelection(root: HTMLElement, style: InlineTextStyle): boolean {
  const range = getEditableSelectionRange(root)
  if (!range) return false
  return applyInlineStyleToRange(range, style) !== null
}

function collectTextNodesInRange(range: Range): Text[] {
  if (range.collapsed) return []

  if (
    range.startContainer === range.endContainer &&
    range.startContainer.nodeType === Node.TEXT_NODE
  ) {
    return [range.startContainer as Text]
  }

  const ancestor =
    range.commonAncestorContainer.nodeType === Node.TEXT_NODE
      ? range.commonAncestorContainer.parentNode
      : range.commonAncestorContainer
  if (!ancestor) return []

  const nodes: Text[] = []
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node as Text
      if (!text.data) return
      if (range.intersectsNode(text)) nodes.push(text)
      return
    }
    for (const child of Array.from(node.childNodes)) walk(child)
  }
  walk(ancestor)
  return nodes
}

/**
 * Bumps font sizes inside the selection by `delta` px.
 * Existing inline sizes are adjusted; inherited sizes get an explicit wrapper.
 */
export function bumpFontSizesInSelection(root: HTMLElement, delta: number): boolean {
  const range = getEditableSelectionRange(root)
  if (!range) return false

  const doc = root.ownerDocument
  const win = doc.defaultView
  if (!win) return false

  const textNodes = collectTextNodesInRange(range)
  if (textNodes.length === 0) return false

  const sizedAncestors = new Set<HTMLElement>()
  for (const text of textNodes) {
    let el = text.parentElement
    while (el && root.contains(el)) {
      if (el.style.fontSize) {
        sizedAncestors.add(el)
        break
      }
      if (el === root) break
      el = el.parentElement
    }
  }

  if (sizedAncestors.size > 0) {
    for (const el of sizedAncestors) {
      const current = Number.parseFloat(el.style.fontSize)
      if (!Number.isFinite(current)) continue
      el.style.fontSize = `${Math.max(1, current + delta)}px`
    }
    return true
  }

  for (let i = textNodes.length - 1; i >= 0; i -= 1) {
    const node = textNodes[i]
    if (!node) continue
    const parent = node.parentElement
    if (!parent) continue
    const computed = Number.parseFloat(win.getComputedStyle(parent).fontSize)
    const base = Number.isFinite(computed) ? computed : 16
    const next = Math.max(1, base + delta)

    let start = 0
    let end = node.data.length
    if (node === range.startContainer) start = range.startOffset
    if (node === range.endContainer) end = range.endOffset
    if (start >= end) continue

    const selected = start > 0 ? node.splitText(start) : node
    if (selected.data.length > end - start) {
      selected.splitText(end - start)
    }

    const span = doc.createElement('span')
    span.style.fontSize = `${next}px`
    selected.parentNode?.insertBefore(span, selected)
    span.appendChild(selected)
  }
  return true
}
