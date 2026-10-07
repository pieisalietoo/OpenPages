import { describe, expect, it } from 'vitest'
import { createDocument } from '../src/model/document'
import { sanitizePanelHtml, sanitizeTextHtml } from '../src/model/sanitize-html'
import {
  addSectionToPage,
  addTextSection,
  duplicateSection,
  parseSection,
} from '../src/model/section'

describe('text section htmlMode', () => {
  it('stores htmlMode on add and round-trips through parse/duplicate', () => {
    const doc = createDocument({ title: 'Html' })
    const page = doc.pages[0]!
    const section = addTextSection(page, {
      x: 0,
      y: 0,
      width: 200,
      height: 80,
      content: '{{standings}}',
      htmlMode: true,
    })
    expect(section.htmlMode).toBe(true)

    const viaOptions = addSectionToPage(page, 'text', {
      content: '{{matches}}',
      htmlMode: true,
    })
    expect(viaOptions.type).toBe('text')
    if (viaOptions.type === 'text') expect(viaOptions.htmlMode).toBe(true)

    const parsed = parseSection(JSON.parse(JSON.stringify(section)), 0)
    expect(parsed.type).toBe('text')
    if (parsed.type === 'text') expect(parsed.htmlMode).toBe(true)

    const copy = duplicateSection(page, section.id)
    expect(copy?.type).toBe('text')
    if (copy?.type === 'text') expect(copy.htmlMode).toBe(true)
  })

  it('defaults htmlMode to false when omitted', () => {
    const doc = createDocument({ title: 'Plain' })
    const section = addTextSection(doc.pages[0]!, {
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      content: 'Hello',
    })
    expect(section.htmlMode).toBe(false)
    const parsed = parseSection({ ...section, htmlMode: undefined }, 0)
    expect(parsed.type).toBe('text')
    if (parsed.type === 'text') expect(parsed.htmlMode).toBe(false)
  })
})

describe('sanitizePanelHtml', () => {
  it('keeps img src and class while still stripping scripts', () => {
    const html = sanitizePanelHtml(
      `<div class="fp-standings table"><img class="fp-team-logo" src="https://example.com/a.png" alt="A"><script>alert(1)</script></div>`,
    )
    expect(html).toContain('fp-standings')
    expect(html).toContain('table')
    expect(html).toContain('https://example.com/a.png')
    expect(html).toContain('fp-team-logo')
    expect(html).not.toContain('script')
    expect(html).not.toContain('alert')
  })

  it('keeps display/table styles used by print templates', () => {
    const html = sanitizePanelHtml(
      `<span class="table-cell" style="font-weight:800; display:table-cell; padding-left:0.5rem">12</span>`,
    )
    expect(html).toContain('table-cell')
    expect(html).toMatch(/font-weight:\s*800/)
    expect(html).toMatch(/display:\s*table-cell/)
  })

  it('still strips img in the default text sanitizer', () => {
    expect(sanitizeTextHtml('A<img src="https://example.com/a.png">B')).toBe('AB')
  })
})
