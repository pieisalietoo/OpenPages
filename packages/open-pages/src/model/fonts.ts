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
}

export interface CreateFontCatalogOptions {
  fonts?: OpenPagesFont[]
  /** When false, only `fonts` are returned (default true). */
  includeBuiltins?: boolean
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

/** Merge builtins with host-provided fonts (custom ids override builtins). */
export function createFontCatalog(options: CreateFontCatalogOptions = {}): OpenPagesFont[] {
  const extras = options.fonts ?? []
  const includeBuiltins = options.includeBuiltins !== false
  if (!includeBuiltins) return extras.map((f) => ({ ...f }))

  const byId = new Map<string, OpenPagesFont>()
  for (const font of BUILTIN_FONTS) byId.set(font.id, { ...font })
  for (const font of extras) byId.set(font.id, { ...font })
  const builtins: OpenPagesFont[] = []
  for (const base of BUILTIN_FONTS) {
    const entry = byId.get(base.id)
    if (entry) builtins.push(entry)
  }
  const extraOnly: OpenPagesFont[] = []
  for (const font of extras) {
    if (!BUILTIN_FONTS.some((b) => b.id === font.id)) {
      const entry = byId.get(font.id)
      if (entry) extraOnly.push(entry)
    }
  }
  return [...builtins, ...extraOnly]
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
