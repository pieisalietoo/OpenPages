import type { Asset, OpenPagesDocument, Page } from './document'
import { addImageSection, type ImageFit, type ImageSection } from './section'

export type AssetAdapter = {
  putImage(input: { src: string; kind?: string; id?: string }): Asset
  get(id: string): Asset | null
  list(): Asset[]
}

export type InsertImageFromSrcInput = {
  src: string
  alt: string
  x: number
  y: number
  width: number
  height: number
  fit?: ImageFit
  kind?: string
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}

/** Host-facing adapter that stores image assets on the document. */
export function createDocumentAssetAdapter(doc: OpenPagesDocument): AssetAdapter {
  return {
    putImage(input) {
      const asset: Asset = {
        id: input.id ?? newId('asset'),
        kind: input.kind ?? 'image',
        src: input.src,
      }
      const existing = doc.assets.findIndex((a) => a.id === asset.id)
      if (existing >= 0) {
        doc.assets[existing] = asset
      } else {
        doc.assets.push(asset)
      }
      return asset
    },
    get(id) {
      return doc.assets.find((a) => a.id === id) ?? null
    },
    list() {
      return [...doc.assets]
    },
  }
}

/**
 * Programmatic image insert for ComicsGenerator hosts:
 * registers an asset and adds an image section on the page.
 */
export function insertImageFromSrc(
  doc: OpenPagesDocument,
  page: Page,
  input: InsertImageFromSrcInput,
): { asset: Asset; section: ImageSection } {
  const adapter = createDocumentAssetAdapter(doc)
  const asset = adapter.putImage({
    src: input.src,
    kind: input.kind ?? 'image',
  })
  const section = addImageSection(page, {
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    src: input.src,
    alt: input.alt,
    fit: input.fit ?? 'cover',
  })
  return { asset, section }
}

/** Helper for drag-drop: File → data URL (browser / happy-dom). */
export function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('expected data URL string'))
    }
    reader.readAsDataURL(file)
  })
}
