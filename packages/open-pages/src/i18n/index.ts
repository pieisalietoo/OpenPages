import { type Ref, ref } from 'vue'
import { en } from './locales/en'
import { it } from './locales/it'

export type LocaleCode = 'en' | 'it'

export type MessageTable = Record<string, string>

export interface CreateI18nOptions {
  /** Initial locale (default `en`). */
  locale?: LocaleCode
  /** Deep-merged on top of built-in catalogs (add or override keys). */
  messages?: Partial<Record<LocaleCode, MessageTable>>
}

export interface OpenPagesI18n {
  /** Reactive locale ref (useful in Vue templates). */
  locale: Ref<LocaleCode>
  getLocale: () => LocaleCode
  setLocale: (locale: LocaleCode) => void
  t: (key: string, params?: Record<string, string | number>) => string
  extend: (messages: Partial<Record<LocaleCode, MessageTable>>) => void
}

const BUILTIN: Record<LocaleCode, MessageTable> = {
  en: { ...en },
  it: { ...it },
}

function mergeTables(base: MessageTable, extra?: MessageTable): MessageTable {
  return extra ? { ...base, ...extra } : { ...base }
}

function format(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_m, name: string) =>
    params[name] !== undefined ? String(params[name]) : `{${name}}`,
  )
}

/** Create an i18n controller. Default locale is English. */
export function createI18n(options: CreateI18nOptions = {}): OpenPagesI18n {
  const catalogs: Record<LocaleCode, MessageTable> = {
    en: mergeTables(BUILTIN.en, options.messages?.en),
    it: mergeTables(BUILTIN.it, options.messages?.it),
  }
  const locale = ref<LocaleCode>(options.locale ?? 'en')

  function getLocale(): LocaleCode {
    return locale.value
  }

  function setLocale(next: LocaleCode) {
    locale.value = next
  }

  function t(key: string, params?: Record<string, string | number>): string {
    const primary = catalogs[locale.value]?.[key]
    const fallback = catalogs.en[key]
    return format(primary ?? fallback ?? key, params)
  }

  function extend(messages: Partial<Record<LocaleCode, MessageTable>>) {
    if (messages.en) Object.assign(catalogs.en, messages.en)
    if (messages.it) Object.assign(catalogs.it, messages.it)
  }

  return { locale, getLocale, setLocale, t, extend }
}

export { en as enMessages, it as itMessages }
