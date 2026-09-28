import { describe, expect, it } from 'vitest'
import {
  CURRENT_SCHEMA_VERSION,
  createDocument,
  parseDocument,
  serializeDocument,
} from '../src/model/document'

describe('A1 document schema', () => {
  it('createDocument returns a versioned empty project with one blank page', () => {
    const doc = createDocument({ title: 'Morning Broadsheet' })

    expect(doc.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(doc.meta.title).toBe('Morning Broadsheet')
    expect(doc.pages).toHaveLength(1)
    expect(doc.pages[0]).toMatchObject({
      id: expect.any(String),
      name: 'Page 1',
      width: 794,
      height: 1123,
      sections: [],
    })
    expect(doc.assets).toEqual([])
    expect(doc.meta.createdAt).toEqual(expect.any(String))
    expect(doc.meta.updatedAt).toEqual(expect.any(String))
  })

  it('serializeDocument ↔ parseDocument round-trips', () => {
    const doc = createDocument({ title: 'Zine' })
    const json = serializeDocument(doc)
    const parsed = parseDocument(json)

    expect(parsed).toEqual(doc)
    expect(() => JSON.parse(json)).not.toThrow()
  })

  it('parseDocument rejects missing schemaVersion', () => {
    expect(() => parseDocument('{"meta":{"title":"x"},"pages":[],"assets":[]}')).toThrow(
      /schemaVersion/i,
    )
  })

  it('parseDocument rejects unsupported schemaVersion', () => {
    const payload = JSON.stringify({
      schemaVersion: 999,
      meta: {
        title: 'x',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      pages: [],
      assets: [],
    })
    expect(() => parseDocument(payload)).toThrow(/unsupported schemaVersion/i)
  })

  it('parseDocument rejects malformed JSON', () => {
    expect(() => parseDocument('{')).toThrow(/invalid json/i)
  })

  it('parseDocument rejects non-object root', () => {
    expect(() => parseDocument('[]')).toThrow(/document must be an object/i)
  })

  it('parseDocument rejects page without id', () => {
    const payload = JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      meta: {
        title: 'Broken',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      pages: [{ name: 'Page 1', width: 100, height: 100, sections: [] }],
      assets: [],
    })
    expect(() => parseDocument(payload)).toThrow(/pages\[0\]\.id/i)
  })

  it('exposes migrateDocument stub that returns current docs unchanged', async () => {
    const { migrateDocument } = await import('../src/model/document')
    const doc = createDocument({ title: 'Stub' })
    expect(migrateDocument(doc)).toEqual(doc)
  })
})
