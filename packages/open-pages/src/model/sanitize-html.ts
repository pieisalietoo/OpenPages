const ALLOWED_TAGS = new Set([
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'S',
  'STRIKE',
  'SPAN',
  'BR',
  'P',
  'DIV',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'UL',
  'OL',
  'LI',
  'BLOCKQUOTE',
])

/** Drop entirely (including text children) — do not unwrap. */
const VOID_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'IMG',
  'VIDEO',
  'AUDIO',
  'SOURCE',
  'SVG',
  'MATH',
  'LINK',
  'META',
  'BASE',
  'FORM',
  'INPUT',
  'BUTTON',
  'TEXTAREA',
  'SELECT',
  'OPTION',
  'APPLET',
  'FRAME',
  'FRAMESET',
])

const ALLOWED_STYLE_PROPS = new Set([
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-variant',
  'line-height',
  'color',
  'text-decoration',
  'text-decoration-line',
  'text-decoration-style',
  'text-decoration-color',
  'background-color',
])

function sanitizeStyle(value: string): string {
  return value
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const colon = part.indexOf(':')
      if (colon < 0) return null
      const prop = part.slice(0, colon).trim().toLowerCase()
      const raw = part.slice(colon + 1).trim()
      if (!ALLOWED_STYLE_PROPS.has(prop)) return null
      if (/expression\s*\(|url\s*\(|javascript:|@import/i.test(raw)) return null
      return `${prop}: ${raw}`
    })
    .filter((entry): entry is string => Boolean(entry))
    .join('; ')
}

function sanitizeNode(node: Node, doc: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return doc.createTextNode(node.textContent ?? '')
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null

  const el = node as Element
  const tag = el.tagName.toUpperCase()
  if (VOID_TAGS.has(tag)) return null

  if (!ALLOWED_TAGS.has(tag)) {
    const frag = doc.createDocumentFragment()
    for (const child of Array.from(el.childNodes)) {
      const clean = sanitizeNode(child, doc)
      if (clean) frag.appendChild(clean)
    }
    return frag.childNodes.length ? frag : null
  }

  const out = doc.createElement(tag.toLowerCase())
  const style = el.getAttribute('style')
  if (style) {
    const cleaned = sanitizeStyle(style)
    if (cleaned) out.setAttribute('style', cleaned)
  }
  if (el.hasAttribute('data-op-chrome-sel')) {
    out.setAttribute('data-op-chrome-sel', '')
  }
  const keep = el.getAttribute('data-op-keep-with-next')
  if (keep !== null) {
    const n = Number.parseInt(keep, 10)
    if (Number.isFinite(n) && n > 0) {
      out.setAttribute('data-op-keep-with-next', String(Math.min(99, Math.floor(n))))
    }
  }

  for (const child of Array.from(el.childNodes)) {
    const clean = sanitizeNode(child, doc)
    if (clean) out.appendChild(clean)
  }
  return out
}

/** Strip scripts, media, embeds, and unsafe attrs from rich-text HTML. */
export function sanitizeTextHtml(html: string): string {
  if (!html) return ''
  if (!/[<>]/.test(html)) return html

  const doc = new DOMParser().parseFromString(`<div id="op-root">${html}</div>`, 'text/html')
  const root = doc.getElementById('op-root')
  if (!root) return ''

  const out = doc.createElement('div')
  for (const child of Array.from(root.childNodes)) {
    const clean = sanitizeNode(child, doc)
    if (clean) out.appendChild(clean)
  }
  return out.innerHTML
}
