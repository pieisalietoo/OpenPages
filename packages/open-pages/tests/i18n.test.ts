import { describe, expect, it } from 'vitest'
import { createI18n } from '../src/i18n'

describe('openpages i18n', () => {
  it('defaults to English and translates known keys', () => {
    const i18n = createI18n()
    expect(i18n.getLocale()).toBe('en')
    expect(i18n.t('tools.section.delete')).toBe('Delete')
    expect(i18n.t('chrome.deleteBlock')).toBe('Delete block')
  })

  it('starts from an initial locale and can switch at runtime', () => {
    const i18n = createI18n({ locale: 'it' })
    expect(i18n.getLocale()).toBe('it')
    expect(i18n.t('tools.section.delete')).toBe('Elimina')
    i18n.setLocale('en')
    expect(i18n.t('tools.section.delete')).toBe('Delete')
  })

  it('merges host overrides without dropping built-in keys', () => {
    const i18n = createI18n({
      locale: 'en',
      messages: {
        en: { 'tools.section.delete': 'Remove', 'host.custom': 'Host only' },
        it: { 'tools.section.delete': 'Rimuovi' },
      },
    })
    expect(i18n.t('tools.section.delete')).toBe('Remove')
    expect(i18n.t('host.custom')).toBe('Host only')
    expect(i18n.t('tools.section.duplicate')).toBe('Duplicate')
    i18n.extend({ en: { 'host.custom': 'Updated' } })
    expect(i18n.t('host.custom')).toBe('Updated')
  })
})
