import { describe, expect, it } from 'vitest'
import { sanitizeTextHtml } from '../src/model/sanitize-html'
import { htmlToPlainText } from '../src/model/text-layout/html-text'
import { inlineRunsFromHtml } from '../src/model/text-layout/inline-runs'
import { layoutTextFrame } from '../src/model/text-layout/layout'
import { createCanvasMeasurer } from '../src/model/text-layout/measure'

const canvas = createCanvasMeasurer()

function hasMidWordSplit(lines: string[]): string[] {
  const mids: string[] = []
  for (let i = 0; i < lines.length - 1; i++) {
    const a = lines[i] ?? ''
    const b = lines[i + 1] ?? ''
    const left = a[a.length - 1]
    const right = b[0]
    if (left && right && /[a-zàèéìòù]/.test(left) && /[a-zàèéìòù]/.test(right)) {
      mids.push(`${JSON.stringify(a.slice(-20))} || ${JSON.stringify(b.slice(0, 20))}`)
    }
  }
  return mids
}

/** Same shape as user: join of `<h3><strong>…</strong></h3><p>…</p>` */
function matchReportsHtml(parts: { headline: string; body: string }[]): string {
  return sanitizeTextHtml(
    parts
      .map(({ headline, body }) => `<h3><strong>${headline}</strong></h3><p>${body}</p>`)
      .join(''),
  )
}

describe('repro: newline in body vs inline-run paint drift', () => {
  it('visible plain must match runs even when body contains \\n', () => {
    const html = matchReportsHtml([
      {
        headline: 'Rapid Peto FK 2 - 3 Cariatidi On The Road',
        body: 'Mister Torluccio: «Raccogliamo i risultati di una entusiastica preparazione estiva.»',
      },
      {
        headline: 'I Zoticoni 2 - 1 IL BOT',
        // Real reports often contain newlines between quotes / paragraphs inside one <p>
        body: "Mister Sandrino e Marchino: «Ma che dire, il mercato di quest'anno si è incentrato completamente su l'unico attaccante.»\n\nMister Doc: «Direi una partenza.»",
      },
    ])
    const plain = htmlToPlainText(html)
    const visible = plain.replace(
      /\uE000\d+\uE001|\uE010[a-z0-9]+\uE011|\uE020[uo]\d*\uE021|\n/g,
      '',
    )
    const runText = inlineRunsFromHtml(html)
      .map((r) => r.text)
      .join('')
    // eslint-disable-next-line no-console
    console.log({
      visibleLen: visible.length,
      runLen: runText.length,
      drift: visible.length - runText.length,
      newlineInRuns: runText.includes('\n'),
      newlineInVisible: visible.includes('\n'),
    })
    expect(runText, 'runs must match visible plain (no \\n drift)').toBe(visible)
  })

  it('painted run slices must not mid-word-wrap when body has \\n (user dump)', () => {
    const html = matchReportsHtml([
      {
        headline: 'Rapid Peto FK 2 - 3 Cariatidi On The Road',
        body: 'Mister Torluccio: «Raccogliamo i risultati di una entusiastica preparazione estiva volta a prendere almeno tre gol a partita.»',
      },
      {
        headline: 'I Zoticoni 2 - 1 IL BOT',
        body: "Mister Sandrino e Marchino: «Ma che dire, il mercato di quest'anno si è incentrato completamente su l'unico attaccante che effettivamente segnerà nella stagione, dal suo discepolo e spiace per l'indipendente che Malen risulta già infortunato... Ops questo forse non è vero! Per il resto con coach Sandrino si è puntato sui giovani di ottime prospettive rinunciando ai caposaldi della nostra difesa del passato come Bremer ma fiduciosi di tutti i nostri nuovi acquisti! Non vorrei risultare provocatorio ma penserei già a come investire i 150 crediti dalla cessione di un certo olandese...»\n\nMister Doc e Mister Ing: «Direi una partenza a rotto di culo.... Del resto la classe non è acqua e nemmeno sborra ...»",
      },
    ])
    const laid = layoutTextFrame({
      text: htmlToPlainText(html),
      host: { x: 0, y: 0, width: 786.5, height: 758 },
      columnCount: 3,
      columnGap: 16,
      fontSize: 16,
      lineHeight: 1,
      fontFamily: 'Calibri, sans-serif',
      exclusions: [],
      measure: canvas,
      inlineRuns: inlineRunsFromHtml(html),
    })
    const lineTexts = laid.lines.map((l) => l.text)
    const painted = laid.lines.map((l) => l.runs?.map((r) => r.text).join('') ?? l.text)
    const midLines = hasMidWordSplit(lineTexts)
    const midPaint = hasMidWordSplit(painted)
    // eslint-disable-next-line no-console
    console.log({
      midLines: midLines.slice(0, 6),
      midPaint: midPaint.slice(0, 6),
      samplePaint: painted.slice(4, 12),
      sampleLine: lineTexts.slice(4, 12),
    })
    // Layout tokens may be fine; the user-visible bug is the PAINTED runs.
    expect(midPaint, JSON.stringify(midPaint.slice(0, 8))).toEqual([])
    expect(midLines).toEqual([])
  })
})
