import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import OpenPagesEditor from '../src/components/OpenPagesEditor.vue'
import { createDocument } from '../src/model/document'
import { SHADOW_HOST_CSS } from '../src/shadow/inject-styles'
import openPagesCss from '../src/style.css?inline'

const HOST_FORMS_CSS = `
[type='text'], [type='email'], [type='url'], [type='password'], [type='number'],
[type='date'], [type='datetime-local'], [type='month'], [type='search'], [type='tel'],
[type='time'], [type='week'], [multiple], textarea, select {
  appearance: none;
  background-color: #fff;
  border-color: #111;
  border-width: 1px;
  border-radius: 0px;
  padding-top: 0.5rem;
  padding-right: 0.75rem;
  padding-bottom: 0.5rem;
  padding-left: 0.75rem;
  font-size: 1rem;
  line-height: 1.5rem;
}
`

describe('shadow DOM host style isolation', () => {
  let hostStyle: HTMLStyleElement | null = null

  afterEach(() => {
    hostStyle?.remove()
    hostStyle = null
  })

  it('mounts the editor inside an open shadow root so host form CSS cannot reach inputs', async () => {
    hostStyle = document.createElement('style')
    hostStyle.setAttribute('data-op-host-pollution', '')
    hostStyle.textContent = HOST_FORMS_CSS
    document.head.appendChild(hostStyle)

    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: createDocument({ title: 'Isolate' }) },
      attachTo: document.body,
    })

    const host = wrapper.element as HTMLElement
    expect(host.getAttribute('data-op-shadow-host')).toBe('')
    expect(host.shadowRoot).toBeTruthy()

    const editor = host.shadowRoot?.querySelector('[data-op-editor]')
    expect(editor).toBeTruthy()

    // Light-DOM queries must not see the editor chrome (encapsulation).
    expect(document.querySelector('[data-op-editor]')).toBeNull()
    expect(document.querySelector('[data-op-tool="layout.save"]')).toBeNull()

    await wrapper.get('[data-op-tool="layout.save"]').trigger('click')
    const input = host.shadowRoot?.querySelector(
      '[data-op-popover="layout.save"] input, .op-save-input',
    ) as HTMLInputElement | null
    expect(input).toBeTruthy()
    if (!input) return
    expect(input.isConnected).toBe(true)
    expect(input.getRootNode()).toBe(host.shadowRoot)

    // Host attribute selectors must not style shadow inputs (browser semantics).
    const padTop = getComputedStyle(input).paddingTop
    expect(padTop).not.toBe('8px') // 0.5rem at default 16px root
    expect(padTop).not.toBe('0.5rem')

    wrapper.unmount()
  })

  it('injects package chrome CSS with host design tokens (toolbar, page, buttons)', async () => {
    // Vitest used to export style.css?inline as ""; shadow isolation needs the real sheet.
    expect(openPagesCss.length).toBeGreaterThan(1000)
    expect(openPagesCss).toMatch(/:host\s*,\s*:root|:root\s*,\s*:host/)
    expect(openPagesCss).toMatch(/--op-accent:\s*#1a5f4a/)
    expect(openPagesCss).toMatch(/--op-page-bg:\s*#f7f4ef/)
    expect(openPagesCss).toMatch(/\.op-toolbar[\s\S]*border-bottom/)
    expect(openPagesCss).toMatch(/\.op-renderer[\s\S]*padding/)
    expect(openPagesCss).toMatch(/\.op-save-btn[\s\S]*background:\s*var\(--op-accent\)/)
    // all:initial clears inherited custom props — tokens must be re-declared on :host.
    expect(SHADOW_HOST_CSS).toMatch(/all:\s*initial/)
    expect(SHADOW_HOST_CSS).toMatch(/--op-accent:\s*#1a5f4a/)

    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: createDocument({ title: 'Tokens' }) },
      attachTo: document.body,
    })

    const host = wrapper.element as HTMLElement
    const shadow = host.shadowRoot
    expect(shadow).toBeTruthy()

    const page = shadow?.querySelector('.op-page') as HTMLElement | null
    expect(page).toBeTruthy()
    if (!page) return
    expect(getComputedStyle(page).backgroundColor).toMatch(
      /^(#f7f4ef|rgb\(\s*247,\s*244,\s*239\s*\))$/i,
    )

    const renderer = shadow?.querySelector('.op-renderer') as HTMLElement | null
    expect(renderer).toBeTruthy()
    if (!renderer) return
    expect(getComputedStyle(renderer).paddingTop).not.toBe('0px')
    expect(getComputedStyle(renderer).paddingTop).not.toBe('')

    await wrapper.get('[data-op-tool="layout.save"]').trigger('click')
    const saveBtn = shadow?.querySelector('.op-save-btn') as HTMLElement | null
    expect(saveBtn).toBeTruthy()
    if (!saveBtn) return
    expect(getComputedStyle(saveBtn).backgroundColor).toMatch(
      /^(#1a5f4a|rgb\(\s*26,\s*95,\s*74\s*\))$/i,
    )

    wrapper.unmount()
  })

  it('injects OpenPagesEditor shadowStyles into the shadow root', async () => {
    const wrapper = mount(OpenPagesEditor, {
      props: {
        modelValue: createDocument({ title: 'HostCss' }),
        shadowStyles: '[data-op-host-mark]{color:rgb(255,0,0)}',
      },
      attachTo: document.body,
    })

    const host = wrapper.element as HTMLElement
    const shadow = host.shadowRoot
    expect(shadow).toBeTruthy()
    if (!shadow) return

    const mark = document.createElement('span')
    mark.setAttribute('data-op-host-mark', '')
    mark.textContent = 'x'
    shadow.querySelector('[data-op-shadow-mount]')?.appendChild(mark)

    const color = getComputedStyle(mark).color
    expect(color).toMatch(/^(#ff0000|rgb\(\s*255,\s*0,\s*0\s*\))$/i)

    wrapper.unmount()
  })

  it('updates injected styles when shadowStyles prop changes', async () => {
    const wrapper = mount(OpenPagesEditor, {
      props: {
        modelValue: createDocument({ title: 'HostCssUpdate' }),
        shadowStyles: '[data-op-host-mark]{color:rgb(255,0,0)}',
      },
      attachTo: document.body,
    })

    const host = wrapper.element as HTMLElement
    const shadow = host.shadowRoot
    expect(shadow).toBeTruthy()
    if (!shadow) return

    const mark = document.createElement('span')
    mark.setAttribute('data-op-host-mark', '')
    mark.textContent = 'x'
    shadow.querySelector('[data-op-shadow-mount]')?.appendChild(mark)

    expect(getComputedStyle(mark).color).toMatch(/^(#ff0000|rgb\(\s*255,\s*0,\s*0\s*\))$/i)

    await wrapper.setProps({
      shadowStyles: '[data-op-host-mark]{color:rgb(0,128,0)}',
    })
    await wrapper.vm.$nextTick()

    // happy-dom may cache getComputedStyle for adoptedStyleSheets; assert sheet text.
    const sheetText = [...(shadow.adoptedStyleSheets ?? [])]
      .map((sheet) => {
        try {
          return [...sheet.cssRules].map((rule) => rule.cssText).join('\n')
        } catch {
          return ''
        }
      })
      .join('\n')
    const tagText = [...shadow.querySelectorAll('style')]
      .map((el) => el.textContent ?? '')
      .join('\n')
    const css = `${sheetText}\n${tagText}`
    expect(css).toMatch(/data-op-host-mark[^}]*rgb\(\s*0\s*,\s*128\s*,\s*0\s*\)/)
    expect(css).not.toMatch(/rgb\(\s*255\s*,\s*0\s*,\s*0\s*\)/)

    wrapper.unmount()
  })
})
