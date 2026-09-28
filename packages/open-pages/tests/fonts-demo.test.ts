import { describe, expect, it } from 'vitest'
import { createCustomFontsDemoDocument, DEMO_CUSTOM_FONTS } from '../src/model/custom-fonts-demo'
import { BUILTIN_FONTS } from '../src/model/fonts'
import { createFontsDemoDocument } from '../src/model/fonts-demo'

describe('fonts demo documents', () => {
  it('creates one text row per builtin font', () => {
    const doc = createFontsDemoDocument()
    expect(doc.meta.title).toBe('Fonts')
    const texts = doc.pages[0]?.sections.filter((s) => s.type === 'text') ?? []
    expect(texts).toHaveLength(BUILTIN_FONTS.length)
    expect(texts.map((t) => (t.type === 'text' ? t.fontFamily : ''))).toEqual(
      BUILTIN_FONTS.map((f) => f.family),
    )
  })

  it('custom fonts demo uses Literata family and declares sources', () => {
    expect(DEMO_CUSTOM_FONTS.every((f) => Boolean(f.source))).toBe(true)
    const doc = createCustomFontsDemoDocument()
    const body = doc.pages[0]?.sections.find((s) => s.type === 'text')
    expect(body && body.type === 'text' && body.fontFamily).toContain('Literata')
  })
})
