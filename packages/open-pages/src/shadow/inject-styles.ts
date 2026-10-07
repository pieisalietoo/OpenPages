/** CSS injected into each OpenPages shadow root (blocks inherited host font/color). */
export const SHADOW_HOST_CSS = `
:host {
  all: initial;
  display: block;
  box-sizing: border-box;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  line-height: normal;
  color: #111;
  /* Re-declare after all:initial (same rule) so chrome tokens inherit into the tree. */
  --op-accent: #1a5f4a;
  --op-selection: #2563eb;
  --op-page-bg: #f7f4ef;
  --op-guide: #94a3b8;
}
:host *,
:host *::before,
:host *::after {
  box-sizing: border-box;
}
`

/** Normalize host `shadowStyles` prop (string or list) into non-empty CSS chunks. */
export function normalizeShadowStyles(styles?: string | readonly string[] | null): string[] {
  if (styles == null) return []
  const list = typeof styles === 'string' ? [styles] : [...styles]
  return list.map((s) => s.trim()).filter((s) => s.length > 0)
}

export type ShadowStyleHandle = {
  /** Replace host extra CSS chunks (package chrome stays). */
  setExtras: (extraCss?: string | readonly string[] | null) => void
}

function tryCreateSheet(doc: Document, cssText: string): CSSStyleSheet | null {
  const Ctor = doc.defaultView?.CSSStyleSheet ?? globalThis.CSSStyleSheet
  if (typeof Ctor !== 'function') return null
  try {
    const sheet = new Ctor()
    if (typeof sheet.replaceSync !== 'function') return null
    sheet.replaceSync(cssText)
    return sheet
  } catch {
    return null
  }
}

function createStyleTag(
  doc: Document,
  cssText: string,
  kind: 'package' | 'extra',
): HTMLStyleElement {
  const style = doc.createElement('style')
  style.setAttribute('data-op-shadow-style', kind)
  style.textContent = cssText
  return style
}

/**
 * Inject package chrome once, then host extras as separate sheets/tags so
 * extras can be replaced on prop/HMR updates without duplicating package CSS.
 */
export function injectOpenPagesStyles(
  shadow: ShadowRoot,
  packageCss: string,
  extraCss: readonly string[] = [],
): ShadowStyleHandle {
  const doc = shadow.ownerDocument
  const packageText = `${SHADOW_HOST_CSS}\n${packageCss}`

  const packageSheet = 'adoptedStyleSheets' in shadow ? tryCreateSheet(doc, packageText) : null

  let packageTag: HTMLStyleElement | null = null
  const extraSheets: CSSStyleSheet[] = []
  const extraTags: HTMLStyleElement[] = []

  if (packageSheet) {
    shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, packageSheet]
  } else {
    packageTag = createStyleTag(doc, packageText, 'package')
    shadow.insertBefore(packageTag, shadow.firstChild)
  }

  const clearExtras = () => {
    if (extraSheets.length && 'adoptedStyleSheets' in shadow) {
      const drop = new Set(extraSheets)
      shadow.adoptedStyleSheets = shadow.adoptedStyleSheets.filter((sheet) => !drop.has(sheet))
      extraSheets.length = 0
    }
    for (const tag of extraTags) tag.remove()
    extraTags.length = 0
  }

  const setExtras = (next?: string | readonly string[] | null) => {
    clearExtras()
    for (const css of normalizeShadowStyles(next)) {
      const sheet = 'adoptedStyleSheets' in shadow ? tryCreateSheet(doc, css) : null
      if (sheet) {
        extraSheets.push(sheet)
        shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, sheet]
        continue
      }
      const tag = createStyleTag(doc, css, 'extra')
      if (packageTag?.nextSibling) {
        shadow.insertBefore(tag, packageTag.nextSibling)
      } else if (packageTag) {
        shadow.appendChild(tag)
      } else {
        shadow.insertBefore(tag, shadow.firstChild)
      }
      extraTags.push(tag)
    }
  }

  setExtras(extraCss)
  return { setExtras }
}
