import { describe, expect, it, vi } from 'vitest'
import { createDocument } from '../src/model/document'
import { createLayoutLibrary } from '../src/model/layouts'
import { addTextSection } from '../src/model/section'

function pageOf(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected page')
  return page
}

describe('layout library', () => {
  it('preloads named layouts and selects by name', () => {
    const blank = createDocument({ title: 'Blank' })
    const feature = createDocument({ title: 'Feature' })
    addTextSection(pageOf(feature), {
      x: 10,
      y: 10,
      width: 100,
      height: 40,
      content: 'hello',
    })

    const lib = createLayoutLibrary({
      layouts: [
        { name: 'Blank', document: blank },
        { name: 'Feature', document: feature },
      ],
      activeName: 'Blank',
    })

    expect(lib.list().map((l) => l.name)).toEqual(['Blank', 'Feature'])
    expect(lib.getActive()?.name).toBe('Blank')
    expect(lib.getActive()?.document.meta.title).toBe('Blank')

    lib.select('Feature')
    expect(lib.getActive()?.name).toBe('Feature')
    expect(lib.getActive()?.document.pages[0]?.sections).toHaveLength(1)
  })

  it('save stores a deep snapshot under a name and emits layoutChange', () => {
    const lib = createLayoutLibrary({
      layouts: [{ name: 'Blank', document: createDocument({ title: 'Blank' }) }],
      activeName: 'Blank',
    })
    const onChange = vi.fn()
    lib.on('layoutChange', onChange)

    const working = createDocument({ title: 'Working' })
    addTextSection(pageOf(working), {
      x: 1,
      y: 2,
      width: 3,
      height: 4,
      content: 'saved',
    })

    lib.save('My Layout', working)
    expect(lib.list().map((l) => l.name)).toContain('My Layout')

    const active = lib.select('My Layout')
    expect(active?.document.pages[0]?.sections[0]).toMatchObject({ content: 'saved' })
    expect(onChange).toHaveBeenCalled()

    // mutate original after save must not affect stored snapshot
    working.meta.title = 'Mutated'
    expect(lib.select('My Layout')?.document.meta.title).toBe('Working')
  })

  it('select unknown name returns null', () => {
    const lib = createLayoutLibrary({
      layouts: [{ name: 'Blank', document: createDocument({ title: 'Blank' }) }],
    })
    expect(lib.select('Nope')).toBeNull()
  })

  it('treats missing locked as unlocked; respects locked:true on preload', () => {
    const lib = createLayoutLibrary({
      layouts: [
        { name: 'Blank', document: createDocument({ title: 'Blank' }) },
        { name: 'Pinned', document: createDocument({ title: 'Pinned' }), locked: true },
      ],
    })
    const listed = lib.list()
    expect(listed.find((l) => l.name === 'Blank')?.locked).toBe(false)
    expect(listed.find((l) => l.name === 'Pinned')?.locked).toBe(true)
  })

  it('save overwrites an unlocked layout but refuses locked ones', () => {
    const lib = createLayoutLibrary({
      layouts: [
        { name: 'Blank', document: createDocument({ title: 'Blank' }), locked: true },
        { name: 'Draft', document: createDocument({ title: 'Draft' }) },
      ],
    })
    const next = createDocument({ title: 'Next' })
    expect(lib.save('Blank', next)).toBeNull()
    expect(lib.select('Blank')?.document.meta.title).toBe('Blank')

    expect(lib.save('Draft', next)?.document.meta.title).toBe('Next')
    expect(lib.select('Draft')?.document.meta.title).toBe('Next')
  })

  it('remove deletes unlocked layouts and refuses locked or missing', () => {
    const lib = createLayoutLibrary({
      layouts: [
        { name: 'Blank', document: createDocument({ title: 'Blank' }), locked: true },
        { name: 'Draft', document: createDocument({ title: 'Draft' }) },
      ],
      activeName: 'Draft',
    })
    expect(lib.remove('Blank')).toBe(false)
    expect(lib.list().map((l) => l.name)).toEqual(['Blank', 'Draft'])

    expect(lib.remove('Draft')).toBe(true)
    expect(lib.list().map((l) => l.name)).toEqual(['Blank'])
    expect(lib.getActive()?.name).toBe('Blank')
    expect(lib.remove('Nope')).toBe(false)
  })
})
