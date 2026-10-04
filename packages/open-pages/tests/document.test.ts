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

  it('migrates v1 textAlign stretch to justify on parse', () => {
    const payload = JSON.stringify({
      schemaVersion: 1,
      meta: {
        title: 'Old Stretch',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      pages: [
        {
          id: 'page_1',
          name: 'Page 1',
          width: 794,
          height: 1123,
          margins: { top: 48, right: 48, bottom: 48, left: 48 },
          guides: [],
          orientation: 'portrait',
          preset: 'a4',
          sections: [
            {
              id: 'text_1',
              type: 'text',
              x: 0,
              y: 0,
              width: 100,
              height: 40,
              locked: false,
              hidden: false,
              runaround: false,
              groupId: null,
              backgroundColor: 'transparent',
              borderColor: '#000',
              borderWidth: 0,
              content: 'Hi',
              fontFamily: 'sans-serif',
              fontSize: 14,
              fontBold: false,
              fontItalic: false,
              fontUnderline: false,
              fontStrike: false,
              columnCount: 1,
              lineHeight: 1.4,
              textFit: 'none',
              textAlign: 'stretch',
              verticalAlign: 'top',
              color: '#111',
            },
          ],
        },
      ],
      assets: [],
    })
    const parsed = parseDocument(payload)
    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(parsed.pages[0]?.sections[0]).toMatchObject({
      type: 'text',
      textAlign: 'justify',
    })
  })

  it('exposes migrateDocument that upgrades schema to current', async () => {
    const { migrateDocument } = await import('../src/model/document')
    const doc = createDocument({ title: 'Current' })
    expect(migrateDocument(doc)).toEqual(doc)
  })
})
