import { describe, expect, it } from 'vitest'
import { injectOpenPagesStyles } from '../src/shadow/inject-styles'

function shadowCssText(shadow: ShadowRoot): string {
  const fromSheets = [...(shadow.adoptedStyleSheets ?? [])]
    .map((sheet) => {
      try {
        return [...sheet.cssRules].map((rule) => rule.cssText).join('\n')
      } catch {
        return ''
      }
    })
    .join('\n')
  const fromTags = [...shadow.querySelectorAll('style')]
    .map((el) => el.textContent ?? '')
    .join('\n')
  return `${fromSheets}\n${fromTags}`
}

describe('injectOpenPagesStyles extras', () => {
  it('appends host extra CSS strings after package chrome', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const shadow = host.attachShadow({ mode: 'open' })

    injectOpenPagesStyles(shadow, '.op-package { color: blue; }', [
      '.op-host-a { color: red; }',
      '.op-host-b { font-weight: 700; }',
    ])

    const css = shadowCssText(shadow)
    expect(css).toMatch(/:host/)
    expect(css).toMatch(/\.op-package/)
    expect(css).toMatch(/\.op-host-a/)
    expect(css).toMatch(/\.op-host-b/)
    // extras come after package block
    expect(css.indexOf('.op-package')).toBeLessThan(css.indexOf('.op-host-a'))

    host.remove()
  })

  it('replaces extras via setExtras without duplicating package chrome', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const shadow = host.attachShadow({ mode: 'open' })

    const handle = injectOpenPagesStyles(shadow, '.op-package { color: blue; }', [
      '.op-host-a { color: red; }',
    ])
    handle.setExtras(['.op-host-b { color: green; }'])

    const css = shadowCssText(shadow)
    expect(css).toMatch(/\.op-package/)
    expect(css).toMatch(/\.op-host-b/)
    expect(css).not.toMatch(/\.op-host-a/)
    // package chrome still once
    expect(css.split('.op-package').length - 1).toBe(1)

    host.remove()
  })
})
