import { describe, expect, it } from 'vitest'
import { jpegBytesToPdfDataUrl, readJpegPixelSize } from '../src/export/exporters'

function pdfFromDataUrl(dataUrl: string): string {
  const b64 = dataUrl.split(',')[1]
  if (!b64) throw new Error('no base64')
  return atob(b64)
}

function mediaBoxOf(pdf: string): number[] {
  const m = /\/MediaBox\s*\[\s*([^\]]+)\]/.exec(pdf)
  if (!m?.[1]) throw new Error('MediaBox missing')
  return m[1].trim().split(/\s+/).map(Number)
}

function imageDictSize(pdf: string): { width: number; height: number } {
  const m =
    /\/Subtype\s*\/Image[^>]*\/Width\s+(\d+)[^>]*\/Height\s+(\d+)/s.exec(pdf) ??
    /\/Width\s+(\d+)\s*\/Height\s+(\d+)[^>]*\/ColorSpace\s*\/DeviceRGB/.exec(pdf)
  if (!m) throw new Error('Image Width/Height missing')
  return { width: Number(m[1]), height: Number(m[2]) }
}

/**
 * Minimal valid 2×1 baseline JPEG (RGB), SOF0 = 2×1.
 * Simulates html-to-image pixelRatio:2 capture of a 1×CSS-pixel page.
 */
const JPEG_2x1_B64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z'

describe('pdf export page scale (fixed size on any viewer)', () => {
  it('declares image Width/Height matching JPEG pixels (not CSS box)', () => {
    const jpeg = Uint8Array.from(atob(JPEG_2x1_B64), (c) => c.charCodeAt(0))
    const { width: jpegW, height: jpegH } = readJpegPixelSize(jpeg)
    const cssW = Math.max(1, Math.round(jpegW / 2))
    const cssH = Math.max(1, Math.round(jpegH / 2))
    const pdf = pdfFromDataUrl(jpegBytesToPdfDataUrl(jpeg, cssW, cssH))
    const img = imageDictSize(pdf)
    // eslint-disable-next-line no-console
    console.log({ jpegW, jpegH, cssW, cssH, img, mediaBox: mediaBoxOf(pdf) })
    expect(img.width, 'Image /Width must be JPEG pixel width').toBe(jpegW)
    expect(img.height, 'Image /Height must be JPEG pixel height').toBe(jpegH)
  })

  it('MediaBox uses PDF points (72dpi) for CSS px page so A4 stays A4 on phones', () => {
    const jpeg = Uint8Array.from(atob(JPEG_2x1_B64), (c) => c.charCodeAt(0))
    const cssW = 794
    const cssH = 1123
    const pdf = pdfFromDataUrl(jpegBytesToPdfDataUrl(jpeg, cssW, cssH))
    const box = mediaBoxOf(pdf)
    const pt = (px: number) => (px * 72) / 96
    // eslint-disable-next-line no-console
    console.log({ box, expected: [0, 0, pt(cssW), pt(cssH)] })
    expect(box[0]).toBe(0)
    expect(box[1]).toBe(0)
    expect(box[2]).toBeCloseTo(pt(cssW), 5)
    expect(box[3]).toBeCloseTo(pt(cssH), 5)
    expect(box[2]).not.toBe(cssW)
    expect(box[3]).not.toBe(cssH)
  })
})
