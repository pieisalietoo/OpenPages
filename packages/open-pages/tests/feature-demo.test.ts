import { describe, expect, it } from 'vitest'
import { createFeatureDemoDocument } from '../src/model/feature-demo'

describe('feature demo document', () => {
  it('builds a page with headline, text, image, panel, guides, and mixed flags', () => {
    const doc = createFeatureDemoDocument()

    expect(doc.meta.title).toBe('Feature Lab')
    expect(doc.pages).toHaveLength(1)

    const page = doc.pages[0]
    if (!page) throw new Error('expected page')

    expect(page.guides.length).toBeGreaterThanOrEqual(2)
    expect(page.sections.map((s) => s.type)).toEqual([
      'panel',
      'image',
      'headline',
      'text',
      'text',
      'text',
    ])

    const locked = page.sections.find((s) => s.type === 'text' && s.content.includes('locked'))
    const hidden = page.sections.find((s) => s.type === 'text' && s.content.includes('hidden'))
    expect(locked?.locked).toBe(true)
    expect(hidden?.hidden).toBe(true)
  })
})
