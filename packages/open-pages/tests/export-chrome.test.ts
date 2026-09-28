import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('export chrome cleanup', () => {
  it('hides margin guides, runaround dashes, and selection outlines while exporting', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const css = readFileSync(join(here, '../src/style.css'), 'utf8')
    expect(css).toMatch(/\.op-page\.op-exporting[\s\S]*\.op-margin-guide/)
    expect(css).toMatch(/\.op-page\.op-exporting[\s\S]*\.op-section\.is-selected/)
    expect(css).toMatch(/\.op-page\.op-exporting[\s\S]*\.op-section--runaround/)
  })
})
