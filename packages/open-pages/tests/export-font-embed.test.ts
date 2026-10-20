import { beforeEach, describe, expect, it, vi } from 'vitest'

const toPngMock = vi.hoisted(() => vi.fn().mockResolvedValue('data:image/png;base64,xx'))
const toJpegMock = vi.hoisted(() =>
  vi
    .fn()
    .mockResolvedValue(
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z',
    ),
)

vi.mock('html-to-image', () => ({
  toPng: toPngMock,
  toJpeg: toJpegMock,
}))

import { createBrowserExportAdapters, fontEmbedCSSFromFonts } from '../src/export/exporters'
import type { OpenPagesFont } from '../src/model/fonts'

const doni: OpenPagesFont = {
  id: 'doni',
  label: 'Doni',
  family: "'DoniMTBlack', sans-serif",
  faceName: 'DoniMTBlack',
  source: 'data:font/woff;base64,AA==',
  weight: 900,
  style: 'normal',
}

function tinyEl(): HTMLElement {
  const el = document.createElement('div')
  el.getBoundingClientRect = () =>
    ({
      width: 10,
      height: 10,
      top: 0,
      left: 0,
      bottom: 10,
      right: 10,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect
  return el
}

describe('export embeds catalog custom fonts', () => {
  beforeEach(() => {
    toPngMock.mockClear()
    toJpegMock.mockClear()
  })

  it('fontEmbedCSSFromFonts builds @font-face rules from catalog sources', () => {
    const css = fontEmbedCSSFromFonts([
      doni,
      { id: 'georgia', label: 'Georgia', family: 'Georgia, serif' },
    ])
    expect(css).toContain("font-family: 'DoniMTBlack'")
    expect(css).toContain('data:font/woff;base64,AA==')
    expect(css).toContain('font-weight: 900')
    expect(css).not.toContain('Georgia')
  })

  it('toPng passes fontEmbedCSS so html-to-image can paint custom faces', async () => {
    const adapters = createBrowserExportAdapters({ fonts: () => [doni] })
    await adapters.toPng?.(tinyEl())
    expect(toPngMock).toHaveBeenCalledTimes(1)
    const opts = toPngMock.mock.calls[0]?.[1] as { fontEmbedCSS?: string }
    expect(opts.fontEmbedCSS).toContain('DoniMTBlack')
    expect(opts.fontEmbedCSS).toContain('data:font/woff;base64,AA==')
  })

  it('toJpeg (pdf/print raster) also receives fontEmbedCSS', async () => {
    const adapters = createBrowserExportAdapters({ fonts: () => [doni] })
    await adapters.toPdf?.(tinyEl())
    expect(toJpegMock).toHaveBeenCalledTimes(1)
    const opts = toJpegMock.mock.calls[0]?.[1] as { fontEmbedCSS?: string }
    expect(opts.fontEmbedCSS).toContain('DoniMTBlack')
  })
})
