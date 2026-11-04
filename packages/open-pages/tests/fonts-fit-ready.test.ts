import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import OpenPagesEditor from '../src/components/OpenPagesEditor.vue'
import { createDocument } from '../src/model/document'
import { loadOpenPagesFonts, type OpenPagesFont } from '../src/model/fonts'
import { addHeadlineSection } from '../src/model/section'
import { fitTextFrame } from '../src/model/text-layout/fit'
import type { MeasureFn } from '../src/model/text-layout/measure'

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'fonts')
const woffPath = path.join(fixtureDir, 'donimt-black.woff')
const FACE = 'DoniMTBlackFixture'

function doniDataUrl(): string {
  const bytes = readFileSync(woffPath)
  return `data:font/woff;base64,${bytes.toString('base64')}`
}

function doniFont(source: string): OpenPagesFont {
  return {
    id: 'donimt-black-fixture',
    label: 'Doni MT Black',
    family: `'${FACE}', sans-serif`,
    faceName: FACE,
    source,
    weight: 900,
    style: 'normal',
  }
}

/** Narrow until `document.fonts.check` sees the face, then Doni-like wide em. */
function createFaceAwareMeasurer(faceName: string): MeasureFn {
  return (text, style) => {
    const loaded =
      typeof document !== 'undefined' &&
      typeof document.fonts?.check === 'function' &&
      document.fonts.check(`${Math.max(1, Math.round(style.fontSize))}px "${faceName}"`)
    const em = loaded ? 0.95 : 0.4
    return text.length * style.fontSize * em
  }
}

function stubFontsCheck() {
  const check = vi.fn()
  const add = vi.fn()
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: {
      check,
      add,
      ready: Promise.resolve(),
    },
  })
  return { check, add }
}

describe('fit-to-frame waits for wide custom fonts', () => {
  it('ships the Doni MT Black fixture woff used for wide-face fit tests', () => {
    const bytes = readFileSync(woffPath)
    expect(bytes.subarray(0, 4).toString('ascii')).toBe('wOFF')
    expect(bytes.byteLength).toBeGreaterThan(10_000)
  })

  it('loads the Doni MT Black fixture via loadOpenPagesFonts', async () => {
    const { add } = stubFontsCheck()
    const load = vi.fn(async function (this: { family: string }) {
      return this
    })
    class FakeFontFace {
      family: string
      load = load
      constructor(family: string) {
        this.family = family
      }
    }
    vi.stubGlobal('FontFace', FakeFontFace)

    await loadOpenPagesFonts([doniFont(doniDataUrl())])
    expect(load).toHaveBeenCalledTimes(1)
    expect(add).toHaveBeenCalledTimes(1)
    expect(FakeFontFace).toBeTruthy()

    vi.unstubAllGlobals()
  })

  it('fit shrinks once wide face metrics replace fallback metrics', () => {
    const { check } = stubFontsCheck()
    const measure = createFaceAwareMeasurer(FACE)
    const input = {
      text: 'BLACKLETTER MASTHEAD TITLE',
      host: { x: 0, y: 0, width: 420, height: 110 },
      columnCount: 1,
      columnGap: 16,
      fontSize: 48,
      lineHeight: 1.1,
      fontFamily: `'${FACE}', sans-serif`,
      exclusions: [] as [],
      measure,
      mode: 'fill' as const,
    }

    check.mockReturnValue(false)
    const premature = fitTextFrame(input)
    check.mockReturnValue(true)
    const ready = fitTextFrame(input)

    // Wide Doni-like metrics need a smaller fitted size to fill the same frame
    expect(ready.fontSize).toBeLessThan(premature.fontSize)
  })

  it('editor sets data-op-fonts-ready only after catalog woff sources are loaded', async () => {
    stubFontsCheck()
    const load = vi.fn(async function (this: { family: string }) {
      return this
    })
    class FakeFontFace {
      family: string
      load = load
      constructor(family: string) {
        this.family = family
      }
    }
    vi.stubGlobal('FontFace', FakeFontFace)

    const font = doniFont(doniDataUrl())
    const doc = createDocument({ title: 'FontFitMount' })
    const page = doc.pages[0]
    if (!page) throw new Error('expected page')
    const section = addHeadlineSection(page, {
      x: 20,
      y: 40,
      width: 420,
      height: 110,
      content: 'BLACKLETTER MASTHEAD TITLE',
    })
    section.fontFamily = font.family
    section.fontSize = 48
    section.textFit = 'fill'
    section.lineHeight = 1.1

    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: doc, fonts: [font] },
      attachTo: document.body,
    })
    await nextTick()
    // Allow any fire-and-forget mount work
    await new Promise((r) => setTimeout(r, 50))
    await nextTick()

    // Product contract: fit is only trustworthy after custom faces apply
    expect(wrapper.get('[data-op-editor]').attributes('data-op-fonts-ready')).toBe('true')
    expect(load).toHaveBeenCalled()

    wrapper.unmount()
    vi.unstubAllGlobals()
  })
})
