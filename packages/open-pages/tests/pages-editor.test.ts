import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import OpenPagesEditor from '../src/components/OpenPagesEditor.vue'
import { createDocument, parseDocument, serializeDocument } from '../src/model/document'
import { addBlankPage } from '../src/model/pages'
import { addTextSection, groupSections } from '../src/model/section'

function textBox(content: string) {
  return { x: 8, y: 8, width: 160, height: 48, content }
}

function twoPageDoc() {
  const doc = createDocument({ title: 'Issue' })
  const first = doc.pages[0]
  if (!first) throw new Error('page')
  addTextSection(first, textBox('FIRST'))
  const second = addBlankPage(doc, 0)
  addTextSection(second, textBox('SECOND'))
  return doc
}

describe('page navigation', () => {
  it('shows the first page of an incoming multi-page document and steps with the counter', async () => {
    const loaded = parseDocument(serializeDocument(twoPageDoc()))
    const wrapper = mount(OpenPagesEditor, { props: { modelValue: loaded } })

    expect(wrapper.get('[data-op-page-current]').text()).toBe('1')
    expect(wrapper.get('[data-op-page-total]').text()).toBe('2')
    expect(wrapper.text()).toContain('FIRST')
    expect(wrapper.text()).not.toContain('SECOND')
    expect(wrapper.get('[data-op-page-prev]').attributes('disabled')).toBeDefined()

    await wrapper.get('[data-op-page-next]').trigger('click')
    expect(wrapper.get('[data-op-page-current]').text()).toBe('2')
    expect(wrapper.text()).toContain('SECOND')
    expect(wrapper.text()).not.toContain('FIRST')
    expect(wrapper.get('[data-op-page-next]').attributes('disabled')).toBeDefined()

    await wrapper.get('[data-op-page-prev]').trigger('click')
    expect(wrapper.get('[data-op-page-current]').text()).toBe('1')
    expect(wrapper.text()).toContain('FIRST')
  })

  it('jumps to a typed page number and clamps out of range', async () => {
    const doc = twoPageDoc()
    const third = addBlankPage(doc, 1)
    addTextSection(third, textBox('THIRD'))
    const wrapper = mount(OpenPagesEditor, { props: { modelValue: doc } })

    await wrapper.get('[data-op-page-current]').trigger('click')
    const input = wrapper.get('[data-op-page-jump]')
    await input.setValue('3')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.get('[data-op-page-current]').text()).toBe('3')
    expect(wrapper.text()).toContain('THIRD')

    await wrapper.get('[data-op-page-current]').trigger('click')
    const again = wrapper.get('[data-op-page-jump]')
    await again.setValue('99')
    await again.trigger('keydown', { key: 'Enter' })
    expect(wrapper.get('[data-op-page-current]').text()).toBe('3')

    await wrapper.get('[data-op-page-current]').trigger('click')
    const invalid = wrapper.get('[data-op-page-jump]')
    await invalid.setValue('nope')
    await invalid.trigger('keydown', { key: 'Enter' })
    expect(wrapper.get('[data-op-page-current]').text()).toBe('3')
  })

  it('adds a blank page or a copy with unique object ids, and can move or delete a page', async () => {
    const doc = createDocument({ title: 'Issue' })
    const first = doc.pages[0]
    if (!first) throw new Error('page')
    const alpha = addTextSection(first, textBox('alpha'))
    const beta = addTextSection(first, textBox('beta'))
    groupSections(first, [alpha.id, beta.id])
    first.guides = [{ id: 'guide_v', orientation: 'vertical', offset: 30 }]

    const wrapper = mount(OpenPagesEditor, { props: { modelValue: doc } })

    expect(wrapper.get('[data-op-page-delete]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-op-page-move-earlier]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-op-page-move-later]').attributes('disabled')).toBeDefined()

    await wrapper.get('[data-op-page-add]').trigger('click')
    expect(wrapper.find('[data-op-page-add-menu]').exists()).toBe(true)
    await wrapper.get('[data-op-page-add-blank]').trigger('click')

    expect(doc.pages).toHaveLength(2)
    expect(doc.pages[1]?.sections).toEqual([])
    expect(wrapper.get('[data-op-page-current]').text()).toBe('2')
    expect(wrapper.get('[data-op-page-total]').text()).toBe('2')
    expect(wrapper.text()).not.toContain('alpha')

    await wrapper.get('[data-op-page-prev]').trigger('click')
    await wrapper.get('[data-op-page-add]').trigger('click')
    await wrapper.get('[data-op-page-add-copy]').trigger('click')

    expect(doc.pages).toHaveLength(3)
    expect(wrapper.get('[data-op-page-current]').text()).toBe('2')
    const copy = doc.pages[1]
    if (!copy) throw new Error('copy')
    const sourceIds = new Set([
      first.id,
      ...first.sections.map((section) => section.id),
      ...first.guides.map((guide) => guide.id),
      first.sections[0]?.groupId,
    ])
    for (const section of copy.sections) {
      expect(sourceIds.has(section.id)).toBe(false)
      if (section.groupId) expect(sourceIds.has(section.groupId)).toBe(false)
    }
    expect(copy.sections[0]?.groupId).toBe(copy.sections[1]?.groupId)
    expect(copy.guides[0]?.id).not.toBe('guide_v')
    expect(wrapper.text()).toContain('alpha')

    const blank = doc.pages[2]
    if (!blank) throw new Error('blank')
    await wrapper.get('[data-op-page-move-later]').trigger('click')
    expect(doc.pages.map((page) => page.id)).toEqual([first.id, blank.id, copy.id])
    expect(wrapper.get('[data-op-page-current]').text()).toBe('3')

    await wrapper.get('[data-op-page-delete]').trigger('click')
    expect(doc.pages).toHaveLength(2)
    expect(doc.pages.some((page) => page.id === copy.id)).toBe(false)
    expect(wrapper.get('[data-op-page-total]').text()).toBe('2')
  })

  it('exports one png per page when the document has multiple pages', async () => {
    const downloads: string[] = []
    const seen: string[] = []
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download)
    })
    const doc = twoPageDoc()
    const wrapper = mount(OpenPagesEditor, {
      props: {
        modelValue: doc,
        exportAdapters: {
          toPng: async (element) => {
            seen.push(element.textContent ?? '')
            return 'data:image/png;base64,xx'
          },
        },
      },
    })

    await wrapper.get('[data-op-page-next]').trigger('click')
    await wrapper.get('[data-op-tool="export.png"]').trigger('click')
    await vi.waitFor(() => {
      expect(downloads).toEqual(['openpages-page-1.png', 'openpages-page-2.png'])
    })
    expect(seen.some((text) => text.includes('FIRST'))).toBe(true)
    expect(seen.some((text) => text.includes('SECOND'))).toBe(true)
    expect(wrapper.get('[data-op-page-current]').text()).toBe('2')
    click.mockRestore()
  })

  it('exports a single png for a one-page document', async () => {
    const downloads: string[] = []
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download)
    })
    const doc = createDocument({ title: 'Solo' })
    const wrapper = mount(OpenPagesEditor, {
      props: {
        modelValue: doc,
        exportAdapters: {
          toPng: async () => 'data:image/png;base64,xx',
        },
      },
    })

    await wrapper.get('[data-op-tool="export.png"]').trigger('click')
    await vi.waitFor(() => {
      expect(downloads).toEqual(['openpages-page.png'])
    })
    click.mockRestore()
  })
})
