import { describe, expect, it } from 'vitest'
import { DEMO_CUSTOM_FONTS } from '../src/model/custom-fonts-demo'
import {
  applyCatalogFontSelection,
  createFontCatalog,
  fontWeightIsBold,
  matchCatalogFont,
} from '../src/model/fonts'

describe('catalog font selection by id / weight', () => {
  const fonts = createFontCatalog({ fonts: DEMO_CUSTOM_FONTS }).list()

  it('distinguishes Literata regular vs bold despite the same CSS family', () => {
    const regular = matchCatalogFont(fonts, {
      family: "'Literata', Georgia, serif",
      fontBold: false,
    })
    const bold = matchCatalogFont(fonts, {
      family: "'Literata', Georgia, serif",
      fontBold: true,
    })
    expect(regular?.id).toBe('literata')
    expect(bold?.id).toBe('literata-bold')
    expect(fontWeightIsBold(700)).toBe(true)
    expect(fontWeightIsBold(400)).toBe(false)
  })

  it('applyCatalogFontSelection sets family and bold from the catalog entry', () => {
    const boldEntry = fonts.find((f) => f.id === 'literata-bold')
    expect(boldEntry).toBeTruthy()
    if (!boldEntry) return
    expect(applyCatalogFontSelection(boldEntry)).toEqual({
      fontFamily: "'Literata', Georgia, serif",
      fontBold: true,
    })
    const regular = fonts.find((f) => f.id === 'literata')
    expect(regular).toBeTruthy()
    if (!regular) return
    expect(applyCatalogFontSelection(regular)).toEqual({
      fontFamily: "'Literata', Georgia, serif",
      fontBold: false,
    })
  })
})
