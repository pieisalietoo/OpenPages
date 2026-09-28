import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import { createDocument } from '../src/model/document'
import {
  BUILTIN_FONTS,
  createFontCatalog,
  faceNameForFont,
  loadOpenPagesFonts,
  type OpenPagesFont,
} from '../src/model/fonts'
import { addTextSection } from '../src/model/section'

describe('font catalog', () => {
  it('exposes an expanded builtin list beyond the original four families', () => {
    expect(BUILTIN_FONTS.length).toBeGreaterThanOrEqual(10)
    const families = BUILTIN_FONTS.map((f) => f.family)
    expect(families).toEqual(
      expect.arrayContaining([
        'Georgia, serif',
        'Arial, sans-serif',
        "'Courier New', monospace",
        'system-ui, sans-serif',
      ]),
    )
  })

  it('merges custom fonts after builtins and can skip builtins', () => {
    const custom: OpenPagesFont[] = [
      {
        id: 'literata',
        label: 'Literata',
        family: "'Literata', Georgia, serif",
        faceName: 'Literata',
        source: 'https://example.com/literata.woff2',
      },
    ]
    const merged = createFontCatalog({ fonts: custom })
    expect(merged.some((f) => f.id === 'georgia')).toBe(true)
    expect(merged.at(-1)?.id).toBe('literata')

    const onlyCustom = createFontCatalog({ fonts: custom, includeBuiltins: false })
    expect(onlyCustom).toHaveLength(1)
    const literata = custom[0]
    expect(literata).toBeTruthy()
    if (!literata) return
    expect(faceNameForFont(literata)).toBe('Literata')
  })

  it('loadOpenPagesFonts registers FontFace entries for fonts with a source', async () => {
    const load = vi.fn(async function (this: { family: string }) {
      return this
    })
    const add = vi.fn()
    class FakeFontFace {
      family: string
      load = load
      constructor(family: string) {
        this.family = family
      }
    }
    vi.stubGlobal('FontFace', FakeFontFace)
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { add },
    })

    await loadOpenPagesFonts([
      {
        id: 'x',
        label: 'X',
        family: "'X Font', serif",
        faceName: 'X Font',
        source: 'https://example.com/x.woff2',
      },
      { id: 'system', label: 'System', family: 'system-ui, sans-serif' },
    ])

    expect(load).toHaveBeenCalledTimes(1)
    expect(add).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})

describe('renderer font options', () => {
  it('renders catalog fonts in the chrome family select', async () => {
    const doc = createDocument({ title: 'Fonts' })
    const page = doc.pages[0]
    if (!page) throw new Error('expected page')
    const section = addTextSection(page, {
      x: 10,
      y: 60,
      width: 200,
      height: 50,
      content: 'Aa',
    })
    const fonts = createFontCatalog({
      fonts: [{ id: 'demo', label: 'Demo Face', family: "'Demo Face', serif" }],
    })
    const wrapper = mount(OpenPagesRenderer, {
      props: {
        document: doc,
        pageId: page.id,
        selectedSectionIds: [section.id],
        fonts,
      },
      attachTo: document.body,
    })
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    const options = wrapper
      .get('[data-op-text-chrome] select')
      .findAll('option')
      .map((o) => o.text())
    expect(options.length).toBeGreaterThanOrEqual(11)
    expect(options).toContain('Demo Face')
    wrapper.unmount()
  })
})
