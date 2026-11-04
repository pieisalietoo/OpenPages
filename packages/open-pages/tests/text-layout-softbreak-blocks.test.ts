import { describe, expect, it } from 'vitest'
import { sanitizeTextHtml } from '../src/model/sanitize-html'
import { fitTextFrame } from '../src/model/text-layout/fit'
import { htmlToPlainText } from '../src/model/text-layout/html-text'
import { inlineRunsFromHtml } from '../src/model/text-layout/inline-runs'
import { layoutTextFrame } from '../src/model/text-layout/layout'
import { createCanvasMeasurer, createFixedMeasurer } from '../src/model/text-layout/measure'

const fixed = createFixedMeasurer(0.5)
const canvas = createCanvasMeasurer()

const sampleHtml = sanitizeTextHtml(
  [
    '<h3>Rapid Peto FK 2 - 3 Cariatidi On The Road</h3>',
    '<p>Mister Torluccio: «Raccogliamo i risultati di una entusiastica preparazione estiva volta a prendere almeno tre gol a partita.»</p>',
    "<p>Mister Sandro e Mister Marco: «Ma che dire, il mercato di quest'anno si è incentrato completamente su l'unico attaccante che effettivamente segnerà nella stagione, dal suo discepolo e spiace per l'indipendente che Malen risulta già infortunato... Ops questo forse non è vero! Per il resto con coach Sandrino si è puntato sui giovani di ottime prospettive rinunciando ai caposaldi della nostra difesa del passato come Bremer ma fiduciosi di tutti i nostri nuovi acquisti! Non vorrei risultare provocatorio ma penserei già a come investire i 150 crediti dalla cessione di un certo olandese...»</p>",
    '<h3>I Zoticoni 2 - 1 IL BOT</h3>',
    '<p>Mister Doc e Doctor Ing: «Direi una partenza a rotto di culo.... Del resto la classe non è acqua.»</p>',
  ].join(''),
)

/** Absolute inline font-size (e.g. Word paste) must not freeze fit or force mid-word wraps. */
const hugeInlineHtml = sanitizeTextHtml(
  [
    '<h3>Rapid Peto FK 2 - 3 Cariatidi On The Road</h3>',
    '<p><span style="font-size: 100px">Mister Sandro e Mister Marco: «Ma che dire, il mercato di quest\'anno si è incentrato completamente su l\'unico attaccante che effettivamente segnerà nella stagione, dal suo discepolo...»</span></p>',
    '<h3>I Zoticoni 2 - 1 IL BOT</h3>',
    '<p>Mister Doc e Doctor Ing: «Direi una partenza.»</p>',
  ].join(''),
)

/** True when consecutive lines split a word mid-glyph (lowercase | lowercase). */
function hasMidWordSplit(lines: string[]): boolean {
  for (let i = 0; i < lines.length - 1; i++) {
    const a = lines[i] ?? ''
    const b = lines[i + 1] ?? ''
    if (!a || !b) continue
    const left = a[a.length - 1]
    const right = b[0]
    if (!left || !right) continue
    if (/[a-zàèéìòù]/.test(left) && /[a-zàèéìòù]/.test(right)) return true
  }
  return false
}

describe('text-layout soft-break vs block boundaries', () => {
  it('visible plain length matches inline runs (no offset drift)', () => {
    const plain = htmlToPlainText(sampleHtml)
    const visible = plain.replace(
      /\uE000\d+\uE001|\uE010[a-z0-9]+\uE011|\uE020[uo]\d*\uE021|\n/g,
      '',
    )
    const runs = inlineRunsFromHtml(sampleHtml)
    expect(runs.map((r) => r.text).join('')).toBe(visible)
  })

  it('keeps the closing quote off the next heading line', () => {
    const text = htmlToPlainText(sampleHtml)
    const result = layoutTextFrame({
      text,
      host: { x: 0, y: 0, width: 786.5, height: 758 },
      columnCount: 2,
      columnGap: 16,
      fontSize: 21,
      lineHeight: 1,
      fontFamily: 'Calibri, sans-serif',
      exclusions: [],
      measure: fixed,
      inlineRuns: inlineRunsFromHtml(sampleHtml),
    })
    const heading = result.lines.find((l) => l.text.includes('I Zoticoni'))
    expect(heading).toBeTruthy()
    expect(heading?.text.startsWith('»')).toBe(false)
    expect(heading?.text).toMatch(/^I Zoticoni/)
  })

  it('fit scales absolute inline font-size so body does not mid-word-wrap', () => {
    const text = htmlToPlainText(hugeInlineHtml)
    const runs = inlineRunsFromHtml(hugeInlineHtml)
    expect(runs.some((r) => r.fontSize === 100)).toBe(true)

    const result = fitTextFrame({
      text,
      host: { x: 0, y: 0, width: 786.5, height: 758 },
      columnCount: 2,
      columnGap: 16,
      fontSize: 16,
      lineHeight: 1,
      fontFamily: 'Calibri, sans-serif',
      exclusions: [],
      measure: canvas,
      mode: 'fill',
      inlineRuns: runs,
    })

    const texts = result.lines.map((l) => l.text)
    const joined = texts.join('\n')
    expect(hasMidWordSplit(texts)).toBe(false)
    expect(joined).not.toMatch(/»I Zoticoni/)
    expect(joined).not.toMatch(/incentrat\nato/)
    expect(joined).not.toMatch(/quest'a\nnno/)
    expect(result.hadSoftBreak).toBeFalsy()
    // Fit must shrink the authored 100px spans, not leave them frozen
    const bodyRuns = result.lines.flatMap((l) => l.runs ?? [])
    const spanned = bodyRuns.filter((r) => r.fontSize != null)
    expect(spanned.length).toBeGreaterThan(0)
    expect(spanned.every((r) => (r.fontSize ?? 0) < 100)).toBe(true)
  })

  it('fit+canvas on clean HTML still wraps on word boundaries', () => {
    const text = htmlToPlainText(sampleHtml)
    const result = fitTextFrame({
      text,
      host: { x: 0, y: 0, width: 786.5, height: 758 },
      columnCount: 2,
      columnGap: 16,
      fontSize: 16,
      lineHeight: 1,
      fontFamily: 'Calibri, sans-serif',
      exclusions: [],
      measure: canvas,
      mode: 'fill',
      inlineRuns: inlineRunsFromHtml(sampleHtml),
    })
    expect(hasMidWordSplit(result.lines.map((l) => l.text))).toBe(false)
  })
})
