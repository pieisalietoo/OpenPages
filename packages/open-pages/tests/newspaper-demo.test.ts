import { describe, expect, it } from 'vitest'
import { createNewspaperDemoDocument } from '../src/model/newspaper-demo'

describe('newspaper demo document', () => {
  it('builds a masthead, 4-column body, and two mid-page photo wells', () => {
    const doc = createNewspaperDemoDocument()

    expect(doc.meta.title).toBe('Newspaper')
    expect(doc.pages).toHaveLength(1)

    const page = doc.pages[0]
    if (!page) throw new Error('expected page')

    const types = page.sections.map((s) => s.type)
    expect(types).toEqual(['headline', 'text', 'runaround', 'runaround'])

    const headline = page.sections.find((s) => s.type === 'headline')
    const body = page.sections.find((s) => s.type === 'text')
    const wells = page.sections.filter((s) => s.type === 'runaround')

    expect(headline).toMatchObject({
      y: expect.any(Number),
      width: expect.any(Number),
    })
    expect(headline && body && headline.y + headline.height <= body.y).toBe(true)

    expect(body).toMatchObject({ columnCount: 4 })
    expect(body?.content).toMatch(/data-op-keep-with-next="2"/)
    expect(body?.content).toMatch(/<h3[^>]*>[\s\S]*?<\/h3>/i)
    expect(wells).toHaveLength(2)

    for (const well of wells) {
      expect(body).toBeTruthy()
      if (!body) continue
      const overlapsX = well.x < body.x + body.width && well.x + well.width > body.x
      const overlapsY = well.y < body.y + body.height && well.y + well.height > body.y
      expect(overlapsX && overlapsY).toBe(true)
    }
  })
})
