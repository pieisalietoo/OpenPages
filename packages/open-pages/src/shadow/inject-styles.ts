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

export function injectOpenPagesStyles(shadow: ShadowRoot, packageCss: string): void {
  const cssText = `${SHADOW_HOST_CSS}\n${packageCss}`
  const doc = shadow.ownerDocument
  const Ctor = doc.defaultView?.CSSStyleSheet ?? globalThis.CSSStyleSheet
  if (typeof Ctor === 'function' && 'adoptedStyleSheets' in shadow) {
    try {
      const sheet = new Ctor()
      sheet.replaceSync(cssText)
      shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, sheet]
      return
    } catch {
      // fall through to <style>
    }
  }
  const style = doc.createElement('style')
  style.setAttribute('data-op-shadow-style', '')
  style.textContent = cssText
  shadow.insertBefore(style, shadow.firstChild)
}
