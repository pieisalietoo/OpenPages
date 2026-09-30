import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import OpenPagesEditor from '../src/components/OpenPagesEditor.vue'
import { createDocument } from '../src/model/document'
import { createFontCatalog } from '../src/model/fonts'
import { createLayoutLibrary } from '../src/model/layouts'
import { addTextSection } from '../src/model/section'

describe('OpenPagesEditor font catalog UI', () => {
  it('lists fonts in fonts.manage and can add via URL form', async () => {
    const catalog = createFontCatalog({
      includeBuiltins: false,
      fonts: [{ id: 'custom', label: 'Custom', family: "'Custom', serif" }],
    })
    const beforeFontAdd = vi.fn(async () => true)
    const wrapper = mount(OpenPagesEditor, {
      props: {
        modelValue: createDocument({ title: 'Fonts' }),
        fontCatalog: catalog,
        beforeFontAdd,
      },
    })

    expect(wrapper.find('[data-op-tool="fonts.manage"]').exists()).toBe(true)
    await wrapper.get('[data-op-tool="fonts.manage"]').trigger('click')
    expect(wrapper.find('[data-op-popover="fonts.manage"]').exists()).toBe(true)
    expect(wrapper.find('[data-op-font="custom"]').exists()).toBe(true)

    await wrapper.get('[data-op-font-label]').setValue('Literata')
    await wrapper.get('[data-op-font-source]').setValue('https://example.com/literata.woff2')
    await wrapper.get('[data-op-font-add-form]').trigger('submit')

    expect(catalog.list().some((f) => f.id === 'literata')).toBe(true)
    expect(wrapper.find('[data-op-font="literata"]').exists()).toBe(true)
    expect(beforeFontAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        exists: false,
        font: expect.objectContaining({ id: 'literata', label: 'Literata' }),
      }),
    )
  })

  it('skips font add when beforeFontAdd returns false', async () => {
    const catalog = createFontCatalog({ includeBuiltins: false, fonts: [] })
    const wrapper = mount(OpenPagesEditor, {
      props: {
        modelValue: createDocument({ title: 'Fonts' }),
        fontCatalog: catalog,
        beforeFontAdd: async () => false,
      },
    })

    await wrapper.get('[data-op-tool="fonts.manage"]').trigger('click')
    await wrapper.get('[data-op-font-label]').setValue('Literata')
    await wrapper.get('[data-op-font-source]').setValue('https://example.com/literata.woff2')
    await wrapper.get('[data-op-font-add-form]').trigger('submit')

    expect(catalog.list()).toHaveLength(0)
  })

  it('passes exists true to beforeFontAdd when replacing an unlocked font id', async () => {
    const catalog = createFontCatalog({
      includeBuiltins: false,
      fonts: [
        {
          id: 'literata',
          label: 'Literata',
          family: "'Literata', sans-serif",
          source: 'https://example.com/old.woff2',
        },
      ],
    })
    const beforeFontAdd = vi.fn(async () => true)
    const wrapper = mount(OpenPagesEditor, {
      props: {
        modelValue: createDocument({ title: 'Fonts' }),
        fontCatalog: catalog,
        beforeFontAdd,
      },
    })

    await wrapper.get('[data-op-tool="fonts.manage"]').trigger('click')
    await wrapper.get('[data-op-font-label]').setValue('Literata')
    await wrapper.get('[data-op-font-source]').setValue('https://example.com/new.woff2')
    await wrapper.get('[data-op-font-add-form]').trigger('submit')

    expect(beforeFontAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        exists: true,
        font: expect.objectContaining({ id: 'literata' }),
      }),
    )
  })

  it('removes unlocked fonts and hides delete for locked fonts', async () => {
    const catalog = createFontCatalog({
      fonts: [
        { id: 'custom', label: 'Custom', family: "'Custom', serif" },
        { id: 'pinned', label: 'Pinned', family: "'Pinned', serif", locked: true },
      ],
      includeBuiltins: false,
    })
    const wrapper = mount(OpenPagesEditor, {
      props: {
        modelValue: createDocument({ title: 'Fonts' }),
        fontCatalog: catalog,
      },
    })

    await wrapper.get('[data-op-tool="fonts.manage"]').trigger('click')
    expect(wrapper.find('[data-op-font-delete="pinned"]').exists()).toBe(false)
    const del = wrapper.get('[data-op-font-delete="custom"]')
    expect(del.find('.lucide-trash-2').exists()).toBe(true)
    await del.trigger('click')
    expect(wrapper.find('[data-op-delete-confirm]').exists()).toBe(true)
    expect(catalog.list().some((f) => f.id === 'custom')).toBe(true)
    await wrapper.get('[data-op-delete-confirm-yes]').trigger('click')
    expect(catalog.list().some((f) => f.id === 'custom')).toBe(false)
  })

  it('does not remove a font when confirm is cancelled', async () => {
    const catalog = createFontCatalog({
      fonts: [{ id: 'custom', label: 'Custom', family: "'Custom', serif" }],
    })
    const wrapper = mount(OpenPagesEditor, {
      props: {
        modelValue: createDocument({ title: 'Fonts' }),
        fontCatalog: catalog,
      },
    })

    await wrapper.get('[data-op-tool="fonts.manage"]').trigger('click')
    await wrapper.get('[data-op-font-delete="custom"]').trigger('click')
    await wrapper.get('[data-op-delete-confirm-no]').trigger('click')
    expect(catalog.list().some((f) => f.id === 'custom')).toBe(true)
    expect(wrapper.find('[data-op-delete-confirm]').exists()).toBe(false)
  })

  it('emits fontsMissing and shows a dismissible banner when a layout uses unknown fonts', async () => {
    const blank = createDocument({ title: 'Blank' })
    const missingDoc = createDocument({ title: 'Missing' })
    const page = missingDoc.pages[0]
    if (!page) throw new Error('page')
    const section = addTextSection(page, {
      x: 0,
      y: 0,
      width: 40,
      height: 20,
      content: 'x',
    })
    section.fontFamily = "'Gone Font', serif"

    const layouts = createLayoutLibrary({
      layouts: [
        { name: 'Blank', document: blank },
        { name: 'Missing', document: missingDoc },
      ],
      activeName: 'Blank',
    })
    const wrapper = mount(OpenPagesEditor, {
      props: {
        modelValue: blank,
        layoutLibrary: layouts,
        fonts: createFontCatalog().list(),
      },
    })
    await wrapper.get('[data-op-tool="layout.select"]').trigger('click')
    await wrapper.get('[data-op-layout="Missing"]').trigger('click')

    expect(wrapper.emitted('fontsMissing')?.[0]).toEqual([["'Gone Font', serif"]])
    expect(wrapper.find('[data-op-fonts-missing]').exists()).toBe(true)
    await wrapper.get('[data-op-fonts-missing-dismiss]').trigger('click')
    expect(wrapper.find('[data-op-fonts-missing]').exists()).toBe(false)
  })

  it('places the add-font form beside the font list', async () => {
    const catalog = createFontCatalog({
      includeBuiltins: false,
      fonts: [{ id: 'custom', label: 'Custom', family: "'Custom', serif" }],
    })
    const wrapper = mount(OpenPagesEditor, {
      props: {
        modelValue: createDocument({ title: 'Fonts' }),
        fontCatalog: catalog,
      },
    })
    await wrapper.get('[data-op-tool="fonts.manage"]').trigger('click')
    const body = wrapper.get('.op-font-manage-body')
    const list = body.get('.op-font-list')
    const form = body.get('[data-op-font-add-form]')
    expect(list.element.nextElementSibling).toBe(form.element)

    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../src/style.css'),
      'utf8',
    )
    expect(css).toMatch(/\.op-font-manage-body\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*row/s)
  })
})
