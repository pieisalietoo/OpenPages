import type { OpenPagesDocument } from './document'

/** A font available in OpenPages chrome / inspector selects. */
export interface OpenPagesFont {
  id: string
  label: string
  /** CSS `font-family` value stored on text sections. */
  family: string
  /** Optional FontFace family name (defaults to first family token). */
  faceName?: string
  /** Optional URL (woff/woff2/ttf/otf) loaded via `loadOpenPagesFonts`. */
  source?: string
  weight?: string | number
  style?: 'normal' | 'italic'
  /** When true at load time, remove/overwrite via add are refused. Missing → unlocked. */
  locked?: boolean
}

export type FontsChangeEvent = {
  fonts: OpenPagesFont[]
}

export interface CreateFontCatalogOptions {
  fonts?: OpenPagesFont[]
  /** When false, only `fonts` are returned (default true). */
  includeBuiltins?: boolean
}

export interface FontCatalog {
  list: () => OpenPagesFont[]
  add: (font: OpenPagesFont) => OpenPagesFont | null
  remove: (id: string) => boolean
  on: (event: 'fontsChange', listener: (event: FontsChangeEvent) => void) => () => void
}

/** Built-in web-safe / system stacks offered out of the box. */
export const BUILTIN_FONTS: OpenPagesFont[] = [
  { id: 'georgia', label: 'Georgia', family: 'Georgia, serif' },
  { id: 'times', label: 'Times New Roman', family: "'Times New Roman', Times, serif" },
  { id: 'palatino', label: 'Palatino', family: 'Palatino, "Palatino Linotype", serif' },
  { id: 'garamond', label: 'Garamond', family: 'Garamond, serif' },
  { id: 'arial', label: 'Arial', family: 'Arial, sans-serif' },
  { id: 'helvetica', label: 'Helvetica', family: 'Helvetica, Arial, sans-serif' },
  { id: 'verdana', label: 'Verdana', family: 'Verdana, Geneva, sans-serif' },
  { id: 'tahoma', label: 'Tahoma', family: 'Tahoma, Geneva, sans-serif' },
  { id: 'trebuchet', label: 'Trebuchet MS', family: "'Trebuchet MS', sans-serif" },
  { id: 'courier', label: 'Courier New', family: "'Courier New', monospace" },
  { id: 'consolas', label: 'Consolas', family: 'Consolas, "Courier New", monospace' },
  { id: 'system', label: 'System', family: 'system-ui, sans-serif' },
]

export function faceNameForFont(font: OpenPagesFont): string {
  if (font.faceName?.trim()) return font.faceName.trim()
  const first = font.family.split(',')[0] ?? font.family
  return first.replace(/^['"]|['"]$/g, '').trim()
}

function cloneFont(font: OpenPagesFont): OpenPagesFont {
  return { ...font, locked: font.locked === true }
}

function mergeInitialFonts(options: CreateFontCatalogOptions): OpenPagesFont[] {
  const extras = options.fonts ?? []
  const includeBuiltins = options.includeBuiltins !== false

  if (!includeBuiltins) {
    return extras.map((font) => cloneFont(font))
  }

  const byId = new Map<string, OpenPagesFont>()
  for (const font of BUILTIN_FONTS) {
    byId.set(font.id, cloneFont(font))
  }
  for (const font of extras) {
    byId.set(font.id, cloneFont(font))
  }

  const builtins: OpenPagesFont[] = []
  for (const base of BUILTIN_FONTS) {
    const entry = byId.get(base.id)
    if (entry) builtins.push(cloneFont(entry))
  }
  const extraOnly: OpenPagesFont[] = []
  for (const font of extras) {
    if (!BUILTIN_FONTS.some((b) => b.id === font.id)) {
      const entry = byId.get(font.id)
      if (entry) extraOnly.push(cloneFont(entry))
    }
  }
  return [...builtins, ...extraOnly]
}

/** Merge builtins with host-provided fonts into a mutable catalog. */
export function createFontCatalog(options: CreateFontCatalogOptions = {}): FontCatalog {
  const fonts: OpenPagesFont[] = mergeInitialFonts(options)
  const listeners = new Set<(event: FontsChangeEvent) => void>()

  function list(): OpenPagesFont[] {
    return fonts.map(cloneFont)
  }

  function emit() {
    const event: FontsChangeEvent = { fonts: list() }
    for (const listener of listeners) listener(event)
  }

  return {
    list,
    add(font) {
      const existing = fonts.find((entry) => entry.id === font.id)
      if (existing?.locked) return null
      const next = cloneFont({ ...font, locked: font.locked === true })
      if (existing) {
        Object.assign(existing, next)
      } else {
        fonts.push(next)
      }
      emit()
      return cloneFont(next)
    },
    remove(id) {
      const index = fonts.findIndex((entry) => entry.id === id)
      if (index < 0) return false
      const target = fonts[index]
      if (!target || target.locked) return false
      fonts.splice(index, 1)
      emit()
      return true
    },
    on(_event, listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/** Families referenced by text/headline sections that are not in the catalog. */
export function missingFontFamilies(document: OpenPagesDocument, fonts: OpenPagesFont[]): string[] {
  const known = new Set(fonts.map((font) => font.family))
  const missing: string[] = []
  const seen = new Set<string>()
  for (const page of document.pages) {
    for (const section of page.sections) {
      if (section.type !== 'text' && section.type !== 'headline') continue
      const family = section.fontFamily
      if (!family || known.has(family) || seen.has(family)) continue
      seen.add(family)
      missing.push(family)
    }
  }
  return missing
}

/** Load `@font-face` / FontFace sources for catalog entries that declare `source`. */
export async function loadOpenPagesFonts(fonts: OpenPagesFont[]): Promise<void> {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return
  const jobs: Promise<void>[] = []
  for (const font of fonts) {
    if (!font.source) continue
    const face = new FontFace(
      faceNameForFont(font),
      `url("${font.source.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`,
      {
        weight: String(font.weight ?? 'normal'),
        style: font.style ?? 'normal',
      },
    )
    jobs.push(
      face.load().then((loaded) => {
        document.fonts.add(loaded)
      }),
    )
  }
  await Promise.all(jobs)
}

export function fontWeightIsBold(weight: string | number | undefined): boolean {
  if (weight === undefined) return false
  if (typeof weight === 'number') return weight >= 600
  const normalized = weight.trim().toLowerCase()
  if (normalized === 'bold' || normalized === 'bolder') return true
  const n = Number.parseInt(normalized, 10)
  return Number.isFinite(n) && n >= 600
}

/** Pick the catalog entry that matches a section's family + bold (weight-aware). */
export function matchCatalogFont(
  fonts: OpenPagesFont[],
  state: { family: string; fontBold?: boolean },
): OpenPagesFont | undefined {
  const sameFamily = fonts.filter((f) => f.family === state.family)
  if (sameFamily.length === 0) return undefined
  const wantBold = Boolean(state.fontBold)
  const weightMatch = sameFamily.find((f) => fontWeightIsBold(f.weight) === wantBold)
  if (weightMatch) return weightMatch
  return sameFamily[0]
}

/** Map a catalog entry to section style fields (family + bold from weight). */
export function applyCatalogFontSelection(font: OpenPagesFont): {
  fontFamily: string
  fontBold: boolean
} {
  return {
    fontFamily: font.family,
    fontBold: fontWeightIsBold(font.weight),
  }
}

/** Derive a stable catalog id from a user-facing label. */
export function slugFontId(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'font'
}
