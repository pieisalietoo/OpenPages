import { describe, expect, it } from 'vitest'
import { sanitizeTextHtml } from '../src/model/sanitize-html'
import { fitTextFrame } from '../src/model/text-layout/fit'
import { htmlToPlainText } from '../src/model/text-layout/html-text'
import { inlineRunsFromHtml } from '../src/model/text-layout/inline-runs'
import { layoutTextFrame } from '../src/model/text-layout/layout'
import {
  createCanvasMeasurer,
  createFixedMeasurer,
  measurePlainPrefix,
} from '../src/model/text-layout/measure'

const canvas = createCanvasMeasurer()

/** Matches the user's section: 786.5×758, 3 cols, gap 16 → col ≈ 251.5 */
const HOST = { x: 0, y: 0, width: 786.5, height: 758 }
const COLS = 3
const GAP = 16

const sampleHtml = sanitizeTextHtml(
  [
    '<h3>Rapid Peto FK 2 - 3 Cariatidi On The Road</h3>',
    '<p>Mister Torluccio: «Raccogliamo i risultati di una entusiastica preparazione estiva volta a prendere almeno tre gol a partita.»</p>',
    "<p>Mister Sandrino e Marchino: «Ma che dire, il mercato di quest'anno si è incentrato completamente su l'unico attaccante che effettivamente segnerà nella stagione, dal suo discepolo e spiace per l'indipendente che Malen risulta già infortunato... Ops questo forse non è vero! Per il resto con coach Sandrino si è puntato sui giovani di ottime prospettive rinunciando ai caposaldi della nostra difesa del passato come Bremer ma fiduciosi di tutti i nostri nuovi acquisti! Non vorrei risultare provocatorio ma penserei già a come investire i 150 crediti dalla cessione di un certo olandese...»</p>",
    '<h3>I Zoticoni 2 - 1 IL BOT</h3>',
    '<p>Mister Doc e Mister Ing: «Direi una partenza a rotto di culo.... Del resto la classe non è acqua e nemmeno sborra ...»</p>',
  ].join(''),
)

/** Lowercase|lowercase only — avoids false positives at heading→body boundaries. */
function hasMidWordSplit(lines: string[]): string[] {
  const mids: string[] = []
  for (let i = 0; i < lines.length - 1; i++) {
    const a = lines[i] ?? ''
    const b = lines[i + 1] ?? ''
    const left = a[a.length - 1]
    const right = b[0]
    if (left && right && /[a-zàèéìòù]/.test(left) && /[a-zàèéìòù]/.test(right)) {
      mids.push(`${JSON.stringify(a.slice(-28))} || ${JSON.stringify(b.slice(0, 28))}`)
    }
  }
  return mids
}

function fitSample(
  html: string,
  exclusions: { x: number; y: number; width: number; height: number }[] = [],
) {
  const text = htmlToPlainText(html)
  const runs = inlineRunsFromHtml(html)
  return fitTextFrame({
    text,
    host: HOST,
    columnCount: COLS,
    columnGap: GAP,
    fontSize: 16,
    lineHeight: 1,
    fontFamily: 'Calibri, sans-serif',
    exclusions,
    measure: canvas,
    mode: 'fill',
    inlineRuns: runs,
  })
}

describe('repro: Calibri 3-col fit mid-word wrap (user dump)', () => {
  it('baseline: clean HTML + Calibri does not mid-word-wrap', () => {
    const fitted = fitSample(sampleHtml)
    const mids = hasMidWordSplit(fitted.lines.map((l) => l.text))
    // eslint-disable-next-line no-console
    console.log('clean', {
      fontSize: fitted.fontSize,
      hadSoftBreak: fitted.hadSoftBreak,
      midCount: mids.length,
      sample: fitted.lines.slice(6, 14).map((l) => l.text),
    })
    expect(fitted.hadSoftBreak).toBeFalsy()
    expect(mids).toEqual([])
  })

  it('incentrato at 22px fits a 251.5px column — soft-breaking it is unjustified by measure', () => {
    const w = measurePlainPrefix('incentrato', 10, canvas, {
      fontFamily: 'Calibri, sans-serif',
      fontSize: 22.3197,
    })
    expect(w).toBeLessThan(251.5)
  })

  it('runaround alone does not mid-word-wrap clean body text', () => {
    const fitted = fitSample(sampleHtml, [{ x: 200, y: 300, width: 120, height: 80 }])
    expect(hasMidWordSplit(fitted.lines.map((l) => l.text))).toEqual([])
  })

  it('Unicode blank separators must not cause mid-word soft-breaks (user-dump signature)', () => {
    const poisoned = sampleHtml.replace(/>[^<]+</g, (chunk) => chunk.replace(/ /g, '\u2800'))
    const fitted = fitSample(poisoned)
    const texts = fitted.lines.map((l) => l.text)
    const mids = hasMidWordSplit(texts)
    // eslint-disable-next-line no-console
    console.log('braille-spaces', {
      fontSize: fitted.fontSize,
      hadSoftBreak: fitted.hadSoftBreak,
      midCount: mids.length,
      mids: mids.slice(0, 8),
      sample: texts.slice(8, 16),
    })
    expect(mids, JSON.stringify(mids.slice(0, 6))).toEqual([])
    expect(fitted.hadSoftBreak).toBeFalsy()
  })

  it('never soft-breaks an oversized token mid-glyph (place whole or skip slot)', () => {
    const measure = createFixedMeasurer(1) // width = len * fontSize
    const text = "il mercato di quest'anno si e incentrato"
    const laid = layoutTextFrame({
      text,
      host: { x: 0, y: 0, width: 80, height: 400 },
      columnCount: 1,
      columnGap: 0,
      fontSize: 10, // each char 10px → any 9+ letter word exceeds 80px
      lineHeight: 1,
      fontFamily: 'Calibri, sans-serif',
      exclusions: [],
      measure,
    })
    const mids = hasMidWordSplit(laid.lines.map((l) => l.text))
    // eslint-disable-next-line no-console
    console.log('oversized-token', {
      hadSoftBreak: laid.hadSoftBreak,
      lines: laid.lines.map((l) => l.text),
      mids,
    })
    expect(mids, JSON.stringify(laid.lines.map((l) => l.text))).toEqual([])
    expect(laid.hadSoftBreak).toBeFalsy()
  })
})
