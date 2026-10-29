import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Repro: PDF/PNG export paints generic sans instead of catalog custom faces
 * (e.g. Bodoni MT Black masthead, Calibri Bold stretch title).
 *
 * Catalog entries often use remote `source` (https://…). We pass them through
 * `fontEmbedCSS`, but html-to-image uses that string as-is and does **not**
 * fetch/inline those URLs (unlike `getFontEmbedCSS()`). Remote `@font-face`
 * then fails in the SVG raster → fallback fonts.
 *
 * Contract: before toPng/toJpeg, every catalog `src: url(...)` in fontEmbedCSS
 * must be a `data:` URL (already inlined), never bare `http(s):`.
 *
 * Synthetic remote URL — do not hit Dropbox/Downloads fixtures at RED time.
 */

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

import { createBrowserExportAdapters } from '../src/export/exporters'
import type { OpenPagesFont } from '../src/model/fonts'

/** Masthead-like custom face with remote source (same shape as FantaPress Dropbox fonts). */
const bodoniRemote: OpenPagesFont = {
  id: 'bodoni-mt-black',
  label: 'Bodoni MT Black',
  family: "'Bodoni MT Black', sans-serif",
  faceName: 'Bodoni MT Black',
  source: 'https://cdn.example.test/fonts/bodoni-mt-black.woff2',
  weight: 900,
  style: 'normal',
}

const calibriBoldRemote: OpenPagesFont = {
  id: 'calibri-bold',
  label: 'Calibri Bold',
  family: "'Calibri Bold', sans-serif",
  faceName: 'Calibri Bold',
  source: 'https://cdn.example.test/fonts/calibri-bold.ttf',
  weight: 700,
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

function assertFontEmbedCssInlined(css: string | undefined, faceName: string) {
  expect(css, 'fontEmbedCSS must be passed').toBeTruthy()
  expect(css).toContain(faceName)
  expect(
    css,
    'html-to-image only paints inlined faces; remote url() in fontEmbedCSS is not fetched',
  ).toMatch(/url\(\s*["']?data:font\//i)
  expect(css, 'fontEmbedCSS must not leave bare http(s) font URLs for the rasterizer').not.toMatch(
    /url\(\s*["']?https?:\/\//i,
  )
}

describe('export inlines remote catalog fonts for html-to-image', () => {
  beforeEach(() => {
    toPngMock.mockClear()
    toJpegMock.mockClear()
  })

  it('toJpeg fontEmbedCSS uses data: URLs for remote Bodoni/Calibri sources', async () => {
    const adapters = createBrowserExportAdapters({
      fonts: () => [bodoniRemote, calibriBoldRemote],
    })
    await adapters.toPdf?.(tinyEl())

    expect(toJpegMock).toHaveBeenCalledTimes(1)
    const opts = toJpegMock.mock.calls[0]?.[1] as { fontEmbedCSS?: string }
    assertFontEmbedCssInlined(opts.fontEmbedCSS, 'Bodoni MT Black')
    expect(opts.fontEmbedCSS).toContain('Calibri Bold')
  })

  it('toPng fontEmbedCSS likewise inlines remote sources as data: URLs', async () => {
    const adapters = createBrowserExportAdapters({
      fonts: () => [bodoniRemote],
    })
    await adapters.toPng?.(tinyEl())

    const opts = toPngMock.mock.calls[0]?.[1] as { fontEmbedCSS?: string }
    assertFontEmbedCssInlined(opts.fontEmbedCSS, 'Bodoni MT Black')
  })
})
