const TEXT_ALLOWED_TAGS = new Set([
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

const PANEL_ALLOWED_TAGS = new Set([
  ...TEXT_ALLOWED_TAGS,
  'IMG',
  'TABLE',
  'THEAD',
  'TBODY',
  'TFOOT',
  'TR',
  'TH',
  'TD',
])

/** Drop entirely (including text children) — do not unwrap. */
const VOID_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'IFRAME',
  'OBJECT',
  'EMBED',
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

const TEXT_STYLE_PROPS = new Set([
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

const PANEL_STYLE_PROPS = new Set([
  ...TEXT_STYLE_PROPS,
  'display',
  'width',
  'height',
  'max-width',
  'max-height',
  'min-width',
  'min-height',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'vertical-align',
  'object-fit',
  'aspect-ratio',
  'border',
  'border-width',
  'border-style',
  'border-color',
  'border-collapse',
  'border-spacing',
  'table-layout',
  'text-align',
  'white-space',
])

type SanitizeMode = 'text' | 'panel'

function sanitizeStyle(value: string, mode: SanitizeMode): string {
  const allowed = mode === 'panel' ? PANEL_STYLE_PROPS : TEXT_STYLE_PROPS
  return value
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const colon = part.indexOf(':')
      if (colon < 0) return null
      const prop = part.slice(0, colon).trim().toLowerCase()
      const raw = part.slice(colon + 1).trim()
      if (!allowed.has(prop)) return null
      if (/expression\s*\(|url\s*\(|javascript:|@import/i.test(raw)) return null
      return `${prop}: ${raw}`
    })
    .filter((entry): entry is string => Boolean(entry))
    .join('; ')
}

function isSafeImageSrc(value: string): boolean {
  const src = value.trim()
  if (!src) return false
  if (/^https?:\/\//i.test(src)) return true
  if (/^data:image\//i.test(src)) return true
  if (src.startsWith('/') && !src.startsWith('//')) return true
  return false
}

function sanitizeNode(node: Node, doc: Document, mode: SanitizeMode): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return doc.createTextNode(node.textContent ?? '')
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null

  const el = node as Element
  const tag = el.tagName.toUpperCase()
  if (VOID_TAGS.has(tag)) return null
  if (mode === 'text' && tag === 'IMG') return null

  const allowedTags = mode === 'panel' ? PANEL_ALLOWED_TAGS : TEXT_ALLOWED_TAGS
  if (!allowedTags.has(tag)) {
    const frag = doc.createDocumentFragment()
    for (const child of Array.from(el.childNodes)) {
      const clean = sanitizeNode(child, doc, mode)
      if (clean) frag.appendChild(clean)
    }
    return frag.childNodes.length ? frag : null
  }

  const out = doc.createElement(tag.toLowerCase())
  const style = el.getAttribute('style')
  if (style) {
    const cleaned = sanitizeStyle(style, mode)
    if (cleaned) out.setAttribute('style', cleaned)
  }
  if (mode === 'panel') {
    const className = el.getAttribute('class')
    if (className) {
      const cleanedClass = className
        .split(/\s+/)
        .map((part) => part.trim())
        .filter((part) => /^[A-Za-z_][\w-]*$/.test(part))
        .join(' ')
      if (cleanedClass) out.setAttribute('class', cleanedClass)
    }
  }
  if (tag === 'IMG') {
    const src = el.getAttribute('src') ?? ''
    const alt = el.getAttribute('alt') ?? ''
    if (!isSafeImageSrc(src)) return null
    out.setAttribute('src', src)
    if (alt) out.setAttribute('alt', alt)
    const width = el.getAttribute('width')
    const height = el.getAttribute('height')
    if (width && /^\d+$/.test(width)) out.setAttribute('width', width)
    if (height && /^\d+$/.test(height)) out.setAttribute('height', height)
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
    const clean = sanitizeNode(child, doc, mode)
    if (clean) out.appendChild(clean)
  }
  return out
}

function sanitizeHtml(html: string, mode: SanitizeMode): string {
  if (!html) return ''
  if (!/[<>]/.test(html)) return html

  const doc = new DOMParser().parseFromString(`<div id="op-root">${html}</div>`, 'text/html')
  const root = doc.getElementById('op-root')
  if (!root) return ''

  const out = doc.createElement('div')
  for (const child of Array.from(root.childNodes)) {
    const clean = sanitizeNode(child, doc, mode)
    if (clean) out.appendChild(clean)
  }
  return out.innerHTML
}

/** Strip scripts, media, embeds, and unsafe attrs from rich-text HTML. */
export function sanitizeTextHtml(html: string): string {
  return sanitizeHtml(html, 'text')
}

/** Wider allowlist for htmlMode panels (img + class + table/display styles). */
export function sanitizePanelHtml(html: string): string {
  return sanitizeHtml(html, 'panel')
}
