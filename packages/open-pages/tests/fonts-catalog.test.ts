import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import { createDocument } from '../src/model/document'
import {
  BUILTIN_FONTS,
  createFontCatalog,
  faceNameForFont,
  loadOpenPagesFonts,
  missingFontFamilies,
  type OpenPagesFont,
} from '../src/model/fonts'
import { addHeadlineSection, addTextSection } from '../src/model/section'

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
    const merged = createFontCatalog({ fonts: custom }).list()
    expect(merged.some((f) => f.id === 'georgia')).toBe(true)
    expect(merged.at(-1)?.id).toBe('literata')

    const onlyCustom = createFontCatalog({ fonts: custom, includeBuiltins: false }).list()
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
    }).list()
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

describe('mutable font catalog', () => {
  it('treats missing locked as unlocked; respects locked:true including builtins', () => {
    const catalog = createFontCatalog({
      fonts: [
        { id: 'custom', label: 'Custom', family: "'Custom', serif" },
        { id: 'georgia', label: 'Georgia Locked', family: 'Georgia, serif', locked: true },
      ],
    })
    expect(catalog.list().find((f) => f.id === 'arial')?.locked).toBe(false)
    expect(catalog.list().find((f) => f.id === 'custom')?.locked).toBe(false)
    expect(catalog.list().find((f) => f.id === 'georgia')?.locked).toBe(true)
    expect(catalog.remove('arial')).toBe(true)
    expect(catalog.remove('georgia')).toBe(false)
    expect(catalog.remove('custom')).toBe(true)
    expect(catalog.list().some((f) => f.id === 'custom')).toBe(false)
  })

  it('add inserts a font, emits fontsChange, and skips overwrite of locked ids', () => {
    const catalog = createFontCatalog({ includeBuiltins: false, fonts: [] })
    const onChange = vi.fn()
    catalog.on('fontsChange', onChange)

    const added = catalog.add({
      id: 'literata',
      label: 'Literata',
      family: "'Literata', serif",
      source: 'https://example.com/l.woff2',
    })
    expect(added).not.toBeNull()
    expect(added?.id).toBe('literata')
    expect(catalog.list()).toHaveLength(1)
    expect(onChange).toHaveBeenCalled()

    catalog.add({
      id: 'literata',
      label: 'Literata',
      family: "'Literata', serif",
      locked: true,
    })
    expect(catalog.remove('literata')).toBe(false)
    expect(
      catalog.add({
        id: 'literata',
        label: 'Other',
        family: 'Other, serif',
      }),
    ).toBeNull()
    expect(catalog.list()[0]?.label).toBe('Literata')
  })

  it('missingFontFamilies reports families used in the document but absent from catalog', () => {
    const doc = createDocument({ title: 'Fonts' })
    const page = doc.pages[0]
    if (!page) throw new Error('page')
    const text = addTextSection(page, {
      x: 0,
      y: 0,
      width: 40,
      height: 20,
      content: 'a',
    })
    text.fontFamily = "'Missing Face', serif"
    const head = addHeadlineSection(page, {
      x: 0,
      y: 30,
      width: 40,
      height: 20,
      content: 'h',
    })
    head.fontFamily = 'Georgia, serif'

    const catalog = createFontCatalog()
    expect(missingFontFamilies(doc, catalog.list())).toEqual(["'Missing Face', serif"])
  })
})
