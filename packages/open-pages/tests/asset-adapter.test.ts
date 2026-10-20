import { describe, expect, it } from 'vitest'
import {
  createDocumentAssetAdapter,
  insertImageFromSrc,
  readImageFileAsDataUrl,
} from '../src/model/assets'
import { createDocument } from '../src/model/document'

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected a page')
  return page
}

describe('F2 assetAdapter + image insert', () => {
  it('registers assets on the document and retrieves them', () => {
    const doc = createDocument({ title: 'Assets' })
    const adapter = createDocumentAssetAdapter(doc)
    const asset = adapter.putImage({
      src: 'https://example.com/a.png',
      kind: 'image',
    })
    expect(asset.id).toBeTruthy()
    expect(doc.assets).toHaveLength(1)
    expect(adapter.get(asset.id)).toEqual(asset)
    expect(adapter.list()).toEqual([asset])
  })

  it('inserts an image section and registers an asset', () => {
    const doc = createDocument({ title: 'Insert' })
    const page = firstPage(doc)
    const { asset, section } = insertImageFromSrc(doc, page, {
      src: 'blob:mock-1',
      alt: 'Panel art',
      x: 40,
      y: 40,
      width: 200,
      height: 160,
      fit: 'cover',
    })
    expect(section.type).toBe('image')
    expect(section.src).toBe('blob:mock-1')
    expect(section.alt).toBe('Panel art')
    expect(doc.assets.map((a) => a.id)).toContain(asset.id)
    expect(page.sections).toContain(section)
  })

  it('readImageFileAsDataUrl reads a File as data URL', async () => {
    const file = new File([Uint8Array.from([137, 80, 78, 71])], 'x.png', {
      type: 'image/png',
    })
    const url = await readImageFileAsDataUrl(file)
    expect(url.startsWith('data:image/png')).toBe(true)
  })
})
