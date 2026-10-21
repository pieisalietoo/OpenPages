import { describe, expect, it } from 'vitest'
import { createDocument, parseDocument, serializeDocument } from '../src/model/document'
import { addImageSection } from '../src/model/section'
import {
  contentTransformCss,
  nudgeImageContent,
  readContentTransform,
  setImageContentTransform,
} from '../src/model/viewport-content'

describe('A5 panel viewport pan/zoom content', () => {
  it('sets transform, persists round-trip, and exposes CSS', () => {
    const doc = createDocument({ title: 'V' })
    const page = doc.pages[0]!
    const img = addImageSection(page, {
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      src: 'data:image/png;base64,aa',
      alt: 'art',
      fit: 'cover',
    })
    expect(readContentTransform(img).contentScale).toBe(1)

    expect(
      setImageContentTransform(page, img.id, {
        contentOffsetX: 12,
        contentOffsetY: -4,
        contentScale: 1.5,
      }),
    ).toBe(true)
    expect(contentTransformCss(img)).toContain('translate(12px, -4px)')
    expect(contentTransformCss(img)).toContain('scale(1.5)')

    const round = parseDocument(serializeDocument(doc))
    const again = round.pages[0]!.sections.find((s) => s.id === img.id)
    expect(again?.type).toBe('image')
    if (again?.type === 'image') {
      expect(again.contentOffsetX).toBe(12)
      expect(again.contentScale).toBe(1.5)
    }

    expect(nudgeImageContent(page, img.id, 1, 0, 0.1)).toBe(true)
    expect(img.contentOffsetX).toBe(13)
    expect(img.contentScale).toBeCloseTo(1.6)
  })
})
