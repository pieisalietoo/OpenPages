import { describe, expect, it } from 'vitest'
import { createDocument } from '../src/model/document'
import { addBlankPage, deletePage, duplicatePage, movePage } from '../src/model/pages'
import { addTextSection, groupSections, type Section } from '../src/model/section'

function textBox(content: string) {
  return { x: 10, y: 20, width: 120, height: 40, content }
}

function textOf(section: Section): string {
  return section.type === 'text' || section.type === 'headline' ? section.content : ''
}

describe('page list', () => {
  it('addBlankPage inserts an empty page after the current one, keeping its geometry', () => {
    const doc = createDocument({ title: 'Issue' })
    const current = doc.pages[0]
    if (!current) throw new Error('page')
    current.margins = { top: 12, right: 16, bottom: 20, left: 24 }
    addTextSection(current, textBox('keep me'))

    const blank = addBlankPage(doc, 0)

    expect(doc.pages).toHaveLength(2)
    expect(doc.pages[1]).toBe(blank)
    expect(blank.id).not.toBe(current.id)
    expect(blank.name).toBe('Page 2')
    expect(blank.sections).toEqual([])
    expect(blank.guides).toEqual([])
    expect(blank).toMatchObject({
      width: current.width,
      height: current.height,
      orientation: current.orientation,
      preset: current.preset,
    })
    expect(blank.margins).toEqual(current.margins)
    expect(blank.margins).not.toBe(current.margins)
    expect(current.sections).toHaveLength(1)
  })

  it('duplicatePage copies the current page and assigns new ids to the page and its objects', () => {
    const doc = createDocument({ title: 'Issue' })
    const current = doc.pages[0]
    if (!current) throw new Error('page')
    current.guides = [{ id: 'guide_v', orientation: 'vertical', offset: 40 }]
    const first = addTextSection(current, textBox('alpha'))
    const second = addTextSection(current, textBox('beta'))
    const other = addTextSection(current, textBox('solo'))
    const groupId = groupSections(current, [first.id, second.id])
    other.groupId = null

    const copy = duplicatePage(doc, 0)
    if (!copy) throw new Error('copy')

    expect(doc.pages).toHaveLength(2)
    expect(doc.pages[1]).toBe(copy)
    expect(copy.id).not.toBe(current.id)
    expect(copy.name).toBe('Page 2')
    expect(copy.sections.map(textOf)).toEqual(current.sections.map(textOf))

    const sourceIds = new Set([
      current.id,
      ...current.sections.map((section) => section.id),
      ...current.guides.map((guide) => guide.id),
      groupId,
    ])
    const copyObjectIds = [
      copy.id,
      ...copy.sections.map((section) => section.id),
      ...copy.guides.map((guide) => guide.id),
    ]
    expect(new Set(copyObjectIds).size).toBe(copyObjectIds.length)
    for (const id of copyObjectIds) {
      expect(sourceIds.has(id)).toBe(false)
    }

    const [copiedFirst, copiedSecond, copiedOther] = copy.sections
    expect(copiedFirst?.groupId).toBe(copiedSecond?.groupId)
    expect(copiedFirst?.groupId).not.toBe(groupId)
    expect(copiedOther?.groupId).toBeNull()

    if (!copiedFirst || copiedFirst.type !== 'text') throw new Error('text')
    copiedFirst.content = 'changed'
    const original = current.sections[0]
    if (!original || original.type !== 'text') throw new Error('text')
    expect(original.content).not.toBe('changed')
  })

  it('deletePage removes a page and refuses to remove the last one', () => {
    const doc = createDocument({ title: 'Issue' })
    const first = doc.pages[0]
    if (!first) throw new Error('page')
    const second = addBlankPage(doc, 0)

    expect(deletePage(doc, 0)).toBe(true)
    expect(doc.pages).toEqual([second])
    expect(deletePage(doc, 0)).toBe(false)
    expect(doc.pages).toEqual([second])
    expect(deletePage(doc, 4)).toBe(false)
  })

  it('movePage reorders pages', () => {
    const doc = createDocument({ title: 'Issue' })
    const first = doc.pages[0]
    if (!first) throw new Error('page')
    const second = addBlankPage(doc, 0)
    const third = addBlankPage(doc, 1)

    expect(movePage(doc, 0, 2)).toBe(true)
    expect(doc.pages.map((page) => page.id)).toEqual([second.id, third.id, first.id])
    expect(movePage(doc, 1, 1)).toBe(false)
    expect(movePage(doc, -1, 0)).toBe(false)
    expect(doc.pages.map((page) => page.id)).toEqual([second.id, third.id, first.id])
  })
})
