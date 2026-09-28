const BLOCK_TAGS = new Set([
  'div',
  'p',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'tr',
  'blockquote',
  'pre',
  'ul',
  'ol',
])

const STYLE_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'li'])

function styleMarker(tag: string): string {
  return `\uE010${tag}\uE011`
}

/** Non-editable list prefix; layout paints it via CSS, not line.text. */
function listMarkerToken(kind: 'ul' | 'ol', index: number): string {
  return kind === 'ol' ? `\uE020o${index}\uE021` : `\uE020u\uE021`
}

function keepMarker(el: Element): string {
  const keep = el.getAttribute('data-op-keep-with-next')
  const n = keep ? Number.parseInt(keep, 10) : NaN
  if (Number.isFinite(n) && n > 0) {
    return `\uE000${Math.min(99, Math.floor(n))}\uE001`
  }
  return ''
}

function domToPlain(node: Node, list?: { kind: 'ul' | 'ol'; index: number }): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? ''
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return ''
  }
  const el = node as Element
  const tag = el.tagName.toLowerCase()
  if (tag === 'br') return '\n'

  if (tag === 'ul' || tag === 'ol') {
    let out = '\n'
    let index = 0
    for (const child of Array.from(el.childNodes)) {
      if (
        child.nodeType === Node.ELEMENT_NODE &&
        (child as Element).tagName.toLowerCase() === 'li'
      ) {
        index++
        out += domToPlain(child, { kind: tag, index })
      } else {
        out += domToPlain(child, list)
      }
    }
    out += '\n'
    return out
  }

  const isBlock = BLOCK_TAGS.has(tag)
  let out = isBlock ? '\n' : ''
  if (isBlock) {
    out += keepMarker(el)
    if (STYLE_TAGS.has(tag)) out += styleMarker(tag)
    if (tag === 'li' && list) {
      out += listMarkerToken(list.kind, list.index)
    }
  }
  for (const child of Array.from(el.childNodes)) {
    out += domToPlain(child, list)
  }
  if (isBlock) out += '\n'
  return out
}

/** HTML from contenteditable → plain text with real newlines for hard breaks. */
export function htmlToPlainText(html: string): string {
  if (!html) return ''
  if (typeof document !== 'undefined') {
    const el = document.createElement('div')
    el.innerHTML = html
    return domToPlain(el)
      .replace(/\u00a0/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\n+|\n+$/g, '')
  }
  return html
    .replace(
      /<(div|p|li|h[1-6]|tr|blockquote|pre|ul|ol)\b([^>]*)>/gi,
      (_m, tag: string, attrs: string) => {
        const keep = /\bdata-op-keep-with-next\s*=\s*["']?(\d+)/i.exec(attrs)
        const n = keep ? Number.parseInt(keep[1] ?? '', 10) : NaN
        const keepMk =
          Number.isFinite(n) && n > 0 ? `\uE000${Math.min(99, Math.floor(n))}\uE001` : ''
        const t = tag.toLowerCase()
        const styleMk = STYLE_TAGS.has(t) ? styleMarker(t) : ''
        return `\n${keepMk}${styleMk}`
      },
    )
    .replace(/<\/(div|p|li|h[1-6]|tr|blockquote|pre|ul|ol)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+|\n+$/g, '')
}
