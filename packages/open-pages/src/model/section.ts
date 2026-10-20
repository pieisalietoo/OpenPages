import { DEFAULT_RUNAROUND_MARGINS, DEFAULT_WRAP_OFFSET, type RunaroundMargins } from './runaround'
import { sanitizePanelHtml, sanitizeTextHtml } from './sanitize-html'
import type { TextFitMode } from './text-layout/fit'

export type SectionType =
  | 'text'
  | 'headline'
  | 'image'
  | 'panel'
  | 'runaround'
  | 'balloon'
  | 'pull-quote'
  | 'byline'
  | 'rule'
  | 'folio'

export type ImageFit = 'cover' | 'contain' | 'fill'
export type PanelBorderStyle = 'ink' | 'double' | 'rounded'
export type BalloonStyle = 'speech' | 'thought'
export type TextAlign = 'left' | 'center' | 'right' | 'justify' | 'stretch'
export type VerticalAlign = 'top' | 'middle' | 'bottom'

export interface SectionBase {
  id: string
  x: number
  y: number
  width: number
  height: number
  locked: boolean
  hidden: boolean
  /** When true, this section excludes text of other frames (not its own). */
  runaround: boolean
  /** Per-side inset/outset added to the section box when `runaround` is on. */
  runaroundMargins: RunaroundMargins
  groupId: string | null
  backgroundColor: string
  color: string
  borderColor: string
  borderWidth: number
}

export interface TextSection extends SectionBase {
  type: 'text'
  content: string
  /** When true, content is rendered as pure HTML (no line-box engine); edit is source-only. */
  htmlMode: boolean
  fontFamily: string
  fontSize: number
  fontBold: boolean
  fontItalic: boolean
  fontUnderline: boolean
  fontStrike: boolean
  columnCount: number
  lineHeight: number
  textFit: TextFitMode
  textAlign: TextAlign
  verticalAlign: VerticalAlign
}

export interface HeadlineSection extends SectionBase {
  type: 'headline'
  content: string
  fontFamily: string
  fontSize: number
  fontBold: boolean
  fontItalic: boolean
  fontUnderline: boolean
  fontStrike: boolean
  columnCount: number
  lineHeight: number
  textFit: TextFitMode
  textAlign: TextAlign
  verticalAlign: VerticalAlign
}

export interface ImageSection extends SectionBase {
  type: 'image'
  src: string
  alt: string
  fit: ImageFit
}

export interface PanelSection extends SectionBase {
  type: 'panel'
  borderStyle: PanelBorderStyle
}

export interface RunaroundSection extends SectionBase {
  type: 'runaround'
  /** Extra gap between zone edge and wrapping text (px). */
  wrapOffset: number
}

export interface BalloonSection extends SectionBase {
  type: 'balloon'
  content: string
  balloonStyle: BalloonStyle
  /** Tail tip X relative to section origin (px). */
  tailX: number
  /** Tail tip Y relative to section origin (px). */
  tailY: number
}

export interface PullQuoteSection extends SectionBase {
  type: 'pull-quote'
  content: string
}

export interface BylineSection extends SectionBase {
  type: 'byline'
  content: string
}

export interface RuleSection extends SectionBase {
  type: 'rule'
}

export interface FolioSection extends SectionBase {
  type: 'folio'
  content: string
}

export type Section =
  | TextSection
  | HeadlineSection
  | ImageSection
  | PanelSection
  | RunaroundSection
  | BalloonSection
  | PullQuoteSection
  | BylineSection
  | RuleSection
  | FolioSection

export interface AddTextSectionInput {
  x: number
  y: number
  width: number
  height: number
  content: string
  htmlMode?: boolean
}

export interface AddHeadlineSectionInput {
  x: number
  y: number
  width: number
  height: number
  content: string
}

export interface AddImageSectionInput {
  x: number
  y: number
  width: number
  height: number
  src: string
  alt: string
  fit: ImageFit
}

export interface AddPanelSectionInput {
  x: number
  y: number
  width: number
  height: number
  borderStyle: PanelBorderStyle
}

export interface AddRunaroundSectionInput {
  x: number
  y: number
  width: number
  height: number
  wrapOffset?: number
}

export interface AddBalloonSectionInput {
  x: number
  y: number
  width: number
  height: number
  content: string
  balloonStyle: BalloonStyle
  tailX: number
  tailY: number
}

export interface AddPullQuoteSectionInput {
  x: number
  y: number
  width: number
  height: number
  content: string
}

export interface AddBylineSectionInput {
  x: number
  y: number
  width: number
  height: number
  content: string
}

export interface AddRuleSectionInput {
  x: number
  y: number
  width: number
  height: number
}

export interface AddFolioSectionInput {
  x: number
  y: number
  width: number
  height: number
  content: string
}

/** Optional overrides when adding a section (geometry/content); omitted fields use type defaults. */
export type AddSectionOptions = {
  x?: number
  y?: number
  width?: number
  height?: number
  content?: string
  htmlMode?: boolean
  src?: string
  alt?: string
  fit?: ImageFit
  borderStyle?: PanelBorderStyle
  wrapOffset?: number
  balloonStyle?: BalloonStyle
  tailX?: number
  tailY?: number
}

export type PageLike = {
  sections: Section[]
  margins?: { top: number; right: number; bottom: number; left: number }
}

const DEFAULT_ADD_SIZE: Record<SectionType, { width: number; height: number; content?: string }> = {
  text: { width: 240, height: 80, content: 'New text' },
  headline: { width: 360, height: 64, content: 'Headline' },
  image: { width: 240, height: 160 },
  panel: { width: 200, height: 160 },
  runaround: { width: 160, height: 120 },
  balloon: { width: 160, height: 80, content: '…' },
  'pull-quote': { width: 220, height: 72, content: 'Pull quote' },
  byline: { width: 180, height: 24, content: 'By Author' },
  rule: { width: 240, height: 4 },
  folio: { width: 40, height: 20, content: '1' },
}

/**
 * Add a section of any type to a page. Position defaults to page margins (or 0);
 * size/content defaults depend on type and can be overridden.
 */
export function addSectionToPage(
  page: PageLike,
  type: SectionType,
  options: AddSectionOptions = {},
): Section {
  const defaults = DEFAULT_ADD_SIZE[type]
  const x = options.x ?? page.margins?.left ?? 0
  const y = options.y ?? page.margins?.top ?? 0
  const width = options.width ?? defaults.width
  const height = options.height ?? defaults.height
  switch (type) {
    case 'text':
      return addTextSection(page, {
        x,
        y,
        width,
        height,
        content: options.content ?? defaults.content ?? 'New text',
        htmlMode: options.htmlMode === true,
      })
    case 'headline':
      return addHeadlineSection(page, {
        x,
        y,
        width,
        height,
        content: options.content ?? defaults.content ?? 'Headline',
      })
    case 'image':
      return addImageSection(page, {
        x,
        y,
        width,
        height,
        src: options.src ?? 'https://picsum.photos/seed/openpages/480/320',
        alt: options.alt ?? 'Image',
        fit: options.fit ?? 'cover',
      })
    case 'panel':
      return addPanelSection(page, {
        x,
        y,
        width,
        height,
        borderStyle: options.borderStyle ?? 'ink',
      })
    case 'runaround':
      return addRunaroundSection(page, {
        x,
        y,
        width,
        height,
        wrapOffset: options.wrapOffset,
      })
    case 'balloon':
      return addBalloonSection(page, {
        x,
        y,
        width,
        height,
        content: options.content ?? defaults.content ?? '…',
        balloonStyle: options.balloonStyle ?? 'speech',
        tailX: options.tailX ?? width / 2,
        tailY: options.tailY ?? height + 16,
      })
    case 'pull-quote':
      return addPullQuoteSection(page, {
        x,
        y,
        width,
        height,
        content: options.content ?? defaults.content ?? 'Pull quote',
      })
    case 'byline':
      return addBylineSection(page, {
        x,
        y,
        width,
        height,
        content: options.content ?? defaults.content ?? 'By Author',
      })
    case 'rule':
      return addRuleSection(page, { x, y, width, height })
    case 'folio':
      return addFolioSection(page, {
        x,
        y,
        width,
        height,
        content: options.content ?? defaults.content ?? '1',
      })
  }
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}

export const DEFAULT_SECTION_STYLE = {
  backgroundColor: 'transparent',
  color: '#1a1a1a',
  borderColor: 'transparent',
  borderWidth: 0,
} as const

export const DEFAULT_TEXT_STYLE = {
  fontFamily: 'Georgia, serif',
  fontSize: 16,
  fontBold: false,
  fontItalic: false,
  fontUnderline: false,
  fontStrike: false,
  columnCount: 1,
  lineHeight: 1.4,
  textFit: 'none' as TextFitMode,
  textAlign: 'left' as TextAlign,
  verticalAlign: 'top' as VerticalAlign,
} as const

export const DEFAULT_HEADLINE_STYLE = {
  fontFamily: 'Georgia, serif',
  fontSize: 32,
  fontBold: true,
  fontItalic: false,
  fontUnderline: false,
  fontStrike: false,
  columnCount: 1,
  lineHeight: 1.15,
  textFit: 'none' as TextFitMode,
  textAlign: 'left' as TextAlign,
  verticalAlign: 'top' as VerticalAlign,
} as const

function defaultChrome() {
  return {
    locked: false,
    hidden: false,
    runaround: false,
    runaroundMargins: { ...DEFAULT_RUNAROUND_MARGINS },
    groupId: null as string | null,
    ...DEFAULT_SECTION_STYLE,
  }
}

export function addTextSection(
  page: { sections: Section[] },
  input: AddTextSectionInput,
): TextSection {
  const htmlMode = input.htmlMode === true
  const section: TextSection = {
    id: newId('sec'),
    type: 'text',
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    content: htmlMode ? sanitizePanelHtml(input.content) : sanitizeTextHtml(input.content),
    htmlMode,
    ...defaultChrome(),
    ...DEFAULT_TEXT_STYLE,
  }
  page.sections.push(section)
  return section
}

export function addHeadlineSection(
  page: { sections: Section[] },
  input: AddHeadlineSectionInput,
): HeadlineSection {
  const section: HeadlineSection = {
    id: newId('sec'),
    type: 'headline',
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    content: sanitizeTextHtml(input.content),
    ...defaultChrome(),
    ...DEFAULT_HEADLINE_STYLE,
  }
  page.sections.push(section)
  return section
}

export function addImageSection(
  page: { sections: Section[] },
  input: AddImageSectionInput,
): ImageSection {
  const section: ImageSection = {
    id: newId('sec'),
    type: 'image',
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    src: input.src,
    alt: input.alt,
    fit: input.fit,
    ...defaultChrome(),
  }
  page.sections.push(section)
  return section
}

export function addPanelSection(
  page: { sections: Section[] },
  input: AddPanelSectionInput,
): PanelSection {
  const section: PanelSection = {
    id: newId('sec'),
    type: 'panel',
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    borderStyle: input.borderStyle,
    ...defaultChrome(),
    borderColor: '#1a1a1a',
    borderWidth: 2,
  }
  page.sections.push(section)
  return section
}

export function addRunaroundSection(
  page: { sections: Section[] },
  input: AddRunaroundSectionInput,
): RunaroundSection {
  const section: RunaroundSection = {
    id: newId('sec'),
    type: 'runaround',
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    wrapOffset:
      typeof input.wrapOffset === 'number' && Number.isFinite(input.wrapOffset)
        ? Math.max(0, input.wrapOffset)
        : DEFAULT_WRAP_OFFSET,
    ...defaultChrome(),
  }
  page.sections.push(section)
  return section
}

export function addBalloonSection(
  page: { sections: Section[] },
  input: AddBalloonSectionInput,
): BalloonSection {
  const section: BalloonSection = {
    id: newId('sec'),
    type: 'balloon',
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    content: sanitizeTextHtml(input.content),
    balloonStyle: input.balloonStyle,
    tailX: input.tailX,
    tailY: input.tailY,
    ...defaultChrome(),
    backgroundColor: '#ffffff',
    borderColor: '#1a1a1a',
    borderWidth: 2,
  }
  page.sections.push(section)
  return section
}

export function addPullQuoteSection(
  page: { sections: Section[] },
  input: AddPullQuoteSectionInput,
): PullQuoteSection {
  const section: PullQuoteSection = {
    id: newId('sec'),
    type: 'pull-quote',
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    content: sanitizeTextHtml(input.content),
    ...defaultChrome(),
  }
  page.sections.push(section)
  return section
}

export function addBylineSection(
  page: { sections: Section[] },
  input: AddBylineSectionInput,
): BylineSection {
  const section: BylineSection = {
    id: newId('sec'),
    type: 'byline',
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    content: sanitizeTextHtml(input.content),
    ...defaultChrome(),
  }
  page.sections.push(section)
  return section
}

export function addRuleSection(
  page: { sections: Section[] },
  input: AddRuleSectionInput,
): RuleSection {
  const section: RuleSection = {
    id: newId('sec'),
    type: 'rule',
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    ...defaultChrome(),
    borderColor: '#1a1a1a',
    borderWidth: 0,
    backgroundColor: '#1a1a1a',
  }
  page.sections.push(section)
  return section
}

export function addFolioSection(
  page: { sections: Section[] },
  input: AddFolioSectionInput,
): FolioSection {
  const section: FolioSection = {
    id: newId('sec'),
    type: 'folio',
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    content: sanitizeTextHtml(input.content),
    ...defaultChrome(),
  }
  page.sections.push(section)
  return section
}

function findSection(page: { sections: Section[] }, sectionId: string): Section | undefined {
  return page.sections.find((section) => section.id === sectionId)
}

export function deleteSection(page: { sections: Section[] }, sectionId: string): boolean {
  const index = page.sections.findIndex((section) => section.id === sectionId)
  if (index < 0) {
    return false
  }
  page.sections.splice(index, 1)
  return true
}

export function duplicateSection(
  page: { sections: Section[] },
  sectionId: string,
): Section | undefined {
  const original = findSection(page, sectionId)
  if (!original) {
    return undefined
  }
  const offset = { x: original.x + 16, y: original.y + 16 }
  let created: Section | undefined
  switch (original.type) {
    case 'text':
      created = addTextSection(page, {
        ...offset,
        width: original.width,
        height: original.height,
        content: original.content,
        htmlMode: original.htmlMode,
      })
      break
    case 'headline':
      created = addHeadlineSection(page, {
        ...offset,
        width: original.width,
        height: original.height,
        content: original.content,
      })
      break
    case 'image':
      created = addImageSection(page, {
        ...offset,
        width: original.width,
        height: original.height,
        src: original.src,
        alt: original.alt,
        fit: original.fit,
      })
      break
    case 'panel':
      created = addPanelSection(page, {
        ...offset,
        width: original.width,
        height: original.height,
        borderStyle: original.borderStyle,
      })
      break
    case 'runaround':
      created = addRunaroundSection(page, {
        ...offset,
        width: original.width,
        height: original.height,
        wrapOffset: original.wrapOffset,
      })
      break
    case 'balloon':
      created = addBalloonSection(page, {
        ...offset,
        width: original.width,
        height: original.height,
        content: original.content,
        balloonStyle: original.balloonStyle,
        tailX: original.tailX,
        tailY: original.tailY,
      })
      break
    case 'pull-quote':
      created = addPullQuoteSection(page, {
        ...offset,
        width: original.width,
        height: original.height,
        content: original.content,
      })
      break
    case 'byline':
      created = addBylineSection(page, {
        ...offset,
        width: original.width,
        height: original.height,
        content: original.content,
      })
      break
    case 'rule':
      created = addRuleSection(page, {
        ...offset,
        width: original.width,
        height: original.height,
      })
      break
    case 'folio':
      created = addFolioSection(page, {
        ...offset,
        width: original.width,
        height: original.height,
        content: original.content,
      })
      break
  }
  if (!created) return undefined
  created.backgroundColor = original.backgroundColor
  created.color = original.color
  created.borderColor = original.borderColor
  created.borderWidth = original.borderWidth
  created.runaround = original.runaround
  created.runaroundMargins = { ...original.runaroundMargins }
  if (
    (created.type === 'text' || created.type === 'headline') &&
    (original.type === 'text' || original.type === 'headline')
  ) {
    created.fontFamily = original.fontFamily
    created.fontSize = original.fontSize
    created.fontBold = original.fontBold
    created.fontItalic = original.fontItalic
    created.fontUnderline = original.fontUnderline
    created.fontStrike = original.fontStrike
    created.columnCount = original.columnCount
    created.lineHeight = original.lineHeight
    created.textFit = original.textFit
    created.textAlign = original.textAlign
    created.verticalAlign = original.verticalAlign
  }
  return created
}

export type SectionStylePatch = {
  backgroundColor?: string
  color?: string
  borderColor?: string
  borderWidth?: number
}

export type TextStylePatch = {
  fontFamily?: string
  fontSize?: number
  fontBold?: boolean
  fontItalic?: boolean
  fontUnderline?: boolean
  fontStrike?: boolean
  columnCount?: number
  lineHeight?: number
  textFit?: TextFitMode
  textAlign?: TextAlign
  verticalAlign?: VerticalAlign
}

export function bumpFontSizes(sizes: number[], delta: number): number[] {
  return sizes.map((size) => Math.max(1, size + delta))
}

export function bumpFontSizesInHtml(content: string, delta: number): string {
  return content.replace(/font-size:\s*([\d.]+)px/gi, (_match, raw: string) => {
    const next = Math.max(1, Number(raw) + delta)
    return `font-size: ${next}px`
  })
}

export function bumpTextSectionFonts(section: TextSection | HeadlineSection, delta: number): void {
  section.fontSize = Math.max(1, section.fontSize + delta)
  section.content = bumpFontSizesInHtml(section.content, delta)
}

export function updateSectionStyle(
  page: { sections: Section[] },
  sectionId: string,
  patch: SectionStylePatch,
): boolean {
  const section = findSection(page, sectionId)
  if (!section) return false
  if (patch.backgroundColor !== undefined) section.backgroundColor = patch.backgroundColor
  if (patch.color !== undefined) section.color = patch.color
  if (patch.borderColor !== undefined) section.borderColor = patch.borderColor
  if (patch.borderWidth !== undefined) section.borderWidth = Math.max(0, patch.borderWidth)
  return true
}

export function updateTextStyle(
  page: { sections: Section[] },
  sectionId: string,
  patch: TextStylePatch,
): boolean {
  const section = findSection(page, sectionId)
  if (!section || (section.type !== 'text' && section.type !== 'headline')) return false
  if (patch.fontFamily !== undefined) section.fontFamily = patch.fontFamily
  if (patch.fontSize !== undefined) section.fontSize = Math.max(1, patch.fontSize)
  if (patch.fontBold !== undefined) section.fontBold = patch.fontBold
  if (patch.fontItalic !== undefined) section.fontItalic = patch.fontItalic
  if (patch.fontUnderline !== undefined) section.fontUnderline = patch.fontUnderline
  if (patch.fontStrike !== undefined) section.fontStrike = patch.fontStrike
  if (patch.columnCount !== undefined) {
    section.columnCount = Math.max(1, Math.min(6, Math.round(patch.columnCount)))
  }
  if (patch.lineHeight !== undefined) {
    section.lineHeight = Math.max(0.5, patch.lineHeight)
  }
  if (patch.textFit !== undefined) {
    section.textFit = patch.textFit === 'fill' ? 'fill' : 'none'
  }
  if (patch.textAlign !== undefined) {
    section.textAlign =
      patch.textAlign === 'center' ||
      patch.textAlign === 'right' ||
      patch.textAlign === 'justify' ||
      patch.textAlign === 'stretch'
        ? patch.textAlign
        : 'left'
  }
  if (patch.verticalAlign !== undefined) {
    section.verticalAlign =
      patch.verticalAlign === 'middle' || patch.verticalAlign === 'bottom'
        ? patch.verticalAlign
        : 'top'
  }
  return true
}

export function reorderSection(
  page: { sections: Section[] },
  sectionId: string,
  toIndex: number,
): boolean {
  const fromIndex = page.sections.findIndex((section) => section.id === sectionId)
  if (fromIndex < 0) {
    return false
  }
  const [section] = page.sections.splice(fromIndex, 1)
  if (!section) {
    return false
  }
  const clamped = Math.max(0, Math.min(toIndex, page.sections.length))
  page.sections.splice(clamped, 0, section)
  return true
}

export function moveSection(
  page: { sections: Section[] },
  sectionId: string,
  x: number,
  y: number,
): boolean {
  const section = findSection(page, sectionId)
  if (!section || section.locked) {
    return false
  }
  section.x = x
  section.y = y
  return true
}

export function resizeSection(
  page: { sections: Section[] },
  sectionId: string,
  width: number,
  height: number,
): boolean {
  const section = findSection(page, sectionId)
  if (!section || section.locked) {
    return false
  }
  section.width = Math.max(1, width)
  section.height = Math.max(1, height)
  return true
}

export type NudgeKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'

export function nudgeSection(
  page: { sections: Section[] },
  sectionId: string,
  key: NudgeKey,
  step: number,
): boolean {
  const section = findSection(page, sectionId)
  if (!section || section.locked) {
    return false
  }
  switch (key) {
    case 'ArrowUp':
      section.y -= step
      break
    case 'ArrowDown':
      section.y += step
      break
    case 'ArrowLeft':
      section.x -= step
      break
    case 'ArrowRight':
      section.x += step
      break
    default:
      return false
  }
  return true
}

export function setSectionLocked(
  page: { sections: Section[] },
  sectionId: string,
  locked: boolean,
): boolean {
  const section = findSection(page, sectionId)
  if (!section) {
    return false
  }
  section.locked = locked
  return true
}

export function setSectionHidden(
  page: { sections: Section[] },
  sectionId: string,
  hidden: boolean,
): boolean {
  const section = findSection(page, sectionId)
  if (!section) {
    return false
  }
  section.hidden = hidden
  return true
}

export function setSectionRunaround(
  page: { sections: Section[] },
  sectionId: string,
  runaround: boolean,
): boolean {
  const section = findSection(page, sectionId)
  if (!section || section.type === 'runaround') {
    return false
  }
  section.runaround = runaround
  return true
}

export function setSectionRunaroundMargins(
  page: { sections: Section[] },
  sectionId: string,
  margins: Partial<RunaroundMargins>,
): boolean {
  const section = findSection(page, sectionId)
  if (!section || section.type === 'runaround') {
    return false
  }
  const next = { ...section.runaroundMargins }
  if (typeof margins.left === 'number' && Number.isFinite(margins.left)) next.left = margins.left
  if (typeof margins.right === 'number' && Number.isFinite(margins.right))
    next.right = margins.right
  if (typeof margins.top === 'number' && Number.isFinite(margins.top)) next.top = margins.top
  if (typeof margins.bottom === 'number' && Number.isFinite(margins.bottom)) {
    next.bottom = margins.bottom
  }
  section.runaroundMargins = next
  return true
}

export function bringForward(page: { sections: Section[] }, sectionId: string): boolean {
  const index = page.sections.findIndex((section) => section.id === sectionId)
  if (index < 0 || index >= page.sections.length - 1) {
    return false
  }
  return reorderSection(page, sectionId, index + 1)
}

export function sendBackward(page: { sections: Section[] }, sectionId: string): boolean {
  const index = page.sections.findIndex((section) => section.id === sectionId)
  if (index <= 0) {
    return false
  }
  return reorderSection(page, sectionId, index - 1)
}

export function bringToFront(page: { sections: Section[] }, sectionId: string): boolean {
  return reorderSection(page, sectionId, page.sections.length - 1)
}

export function sendToBack(page: { sections: Section[] }, sectionId: string): boolean {
  return reorderSection(page, sectionId, 0)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireNumber(record: Record<string, unknown>, key: string, path: string): number {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${path}.${key} must be a finite number`)
  }
  return value
}

function requireString(record: Record<string, unknown>, key: string, path: string): string {
  const value = record[key]
  if (typeof value !== 'string') {
    throw new Error(`${path}.${key} must be a string`)
  }
  return value
}

function parseRunaroundMargins(value: unknown): RunaroundMargins {
  if (!isRecord(value)) {
    return { ...DEFAULT_RUNAROUND_MARGINS }
  }
  const side = (key: keyof RunaroundMargins) => {
    const n = value[key]
    return typeof n === 'number' && Number.isFinite(n) ? n : DEFAULT_RUNAROUND_MARGINS[key]
  }
  return {
    left: side('left'),
    right: side('right'),
    top: side('top'),
    bottom: side('bottom'),
  }
}

function parseTextAlign(value: unknown): TextAlign {
  if (value === 'center' || value === 'right' || value === 'justify' || value === 'stretch') {
    return value
  }
  return 'left'
}

function parseVerticalAlign(value: unknown): VerticalAlign {
  if (value === 'middle' || value === 'bottom') return value
  return 'top'
}

export function parseSection(value: unknown, index: number): Section {
  const path = `sections[${index}]`
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object`)
  }

  const base = {
    id: requireString(value, 'id', path),
    x: requireNumber(value, 'x', path),
    y: requireNumber(value, 'y', path),
    width: requireNumber(value, 'width', path),
    height: requireNumber(value, 'height', path),
    locked: value.locked === true,
    hidden: value.hidden === true,
    runaround: value.runaround === true,
    runaroundMargins: parseRunaroundMargins(value.runaroundMargins),
    groupId: typeof value.groupId === 'string' ? value.groupId : null,
    backgroundColor:
      typeof value.backgroundColor === 'string'
        ? value.backgroundColor
        : DEFAULT_SECTION_STYLE.backgroundColor,
    color: typeof value.color === 'string' ? value.color : DEFAULT_SECTION_STYLE.color,
    borderColor:
      typeof value.borderColor === 'string' ? value.borderColor : DEFAULT_SECTION_STYLE.borderColor,
    borderWidth:
      typeof value.borderWidth === 'number' && Number.isFinite(value.borderWidth)
        ? value.borderWidth
        : DEFAULT_SECTION_STYLE.borderWidth,
  }

  switch (value.type) {
    case 'text': {
      const htmlMode = value.htmlMode === true
      const rawContent = requireString(value, 'content', path)
      return {
        ...base,
        type: 'text',
        content: htmlMode ? sanitizePanelHtml(rawContent) : sanitizeTextHtml(rawContent),
        htmlMode,
        fontFamily:
          typeof value.fontFamily === 'string' ? value.fontFamily : DEFAULT_TEXT_STYLE.fontFamily,
        fontSize:
          typeof value.fontSize === 'number' && Number.isFinite(value.fontSize)
            ? value.fontSize
            : DEFAULT_TEXT_STYLE.fontSize,
        fontBold: value.fontBold === true || value.fontAccent === true,
        fontItalic: value.fontItalic === true,
        fontUnderline: value.fontUnderline === true,
        fontStrike: value.fontStrike === true,
        columnCount:
          typeof value.columnCount === 'number' && Number.isFinite(value.columnCount)
            ? Math.max(1, Math.min(6, Math.round(value.columnCount)))
            : 1,
        lineHeight:
          typeof value.lineHeight === 'number' && Number.isFinite(value.lineHeight)
            ? value.lineHeight
            : DEFAULT_TEXT_STYLE.lineHeight,
        textFit: value.textFit === 'fill' ? 'fill' : 'none',
        textAlign: parseTextAlign(value.textAlign),
        verticalAlign: parseVerticalAlign(value.verticalAlign),
      }
    }
    case 'headline':
      return {
        ...base,
        type: 'headline',
        content: sanitizeTextHtml(requireString(value, 'content', path)),
        fontFamily:
          typeof value.fontFamily === 'string'
            ? value.fontFamily
            : DEFAULT_HEADLINE_STYLE.fontFamily,
        fontSize:
          typeof value.fontSize === 'number' && Number.isFinite(value.fontSize)
            ? value.fontSize
            : DEFAULT_HEADLINE_STYLE.fontSize,
        fontBold:
          value.fontBold === true ||
          value.fontAccent === true ||
          (value.fontBold === undefined && value.fontAccent === undefined),
        fontItalic: value.fontItalic === true,
        fontUnderline: value.fontUnderline === true,
        fontStrike: value.fontStrike === true,
        columnCount:
          typeof value.columnCount === 'number' && Number.isFinite(value.columnCount)
            ? Math.max(1, Math.min(6, Math.round(value.columnCount)))
            : 1,
        lineHeight:
          typeof value.lineHeight === 'number' && Number.isFinite(value.lineHeight)
            ? value.lineHeight
            : DEFAULT_HEADLINE_STYLE.lineHeight,
        textFit: value.textFit === 'fill' ? 'fill' : 'none',
        textAlign: parseTextAlign(value.textAlign),
        verticalAlign: parseVerticalAlign(value.verticalAlign),
      }
    case 'image': {
      const fit = value.fit
      if (fit !== 'cover' && fit !== 'contain' && fit !== 'fill') {
        throw new Error(`${path}.fit must be cover, contain, or fill`)
      }
      return {
        ...base,
        type: 'image',
        src: requireString(value, 'src', path),
        alt: requireString(value, 'alt', path),
        fit,
      }
    }
    case 'panel': {
      const borderStyle = value.borderStyle
      if (borderStyle !== 'ink' && borderStyle !== 'double' && borderStyle !== 'rounded') {
        throw new Error(`${path}.borderStyle must be ink, double, or rounded`)
      }
      return {
        ...base,
        type: 'panel',
        borderStyle,
      }
    }
    case 'runaround': {
      const wrapOffset =
        typeof value.wrapOffset === 'number' && Number.isFinite(value.wrapOffset)
          ? Math.max(0, value.wrapOffset)
          : DEFAULT_WRAP_OFFSET
      return {
        ...base,
        type: 'runaround',
        wrapOffset,
      }
    }
    case 'balloon': {
      const balloonStyle = value.balloonStyle
      if (balloonStyle !== 'speech' && balloonStyle !== 'thought') {
        throw new Error(`${path}.balloonStyle must be speech or thought`)
      }
      const tailX =
        typeof value.tailX === 'number' && Number.isFinite(value.tailX)
          ? value.tailX
          : base.width / 2
      const tailY =
        typeof value.tailY === 'number' && Number.isFinite(value.tailY)
          ? value.tailY
          : base.height + 16
      return {
        ...base,
        type: 'balloon',
        content: sanitizeTextHtml(requireString(value, 'content', path)),
        balloonStyle,
        tailX,
        tailY,
      }
    }
    case 'pull-quote':
      return {
        ...base,
        type: 'pull-quote',
        content: sanitizeTextHtml(requireString(value, 'content', path)),
      }
    case 'byline':
      return {
        ...base,
        type: 'byline',
        content: sanitizeTextHtml(requireString(value, 'content', path)),
      }
    case 'rule':
      return {
        ...base,
        type: 'rule',
      }
    case 'folio':
      return {
        ...base,
        type: 'folio',
        content: sanitizeTextHtml(requireString(value, 'content', path)),
      }
    default:
      throw new Error(`${path}.type is unsupported`)
  }
}

export function groupSections(page: { sections: Section[] }, sectionIds: string[]): string | null {
  if (sectionIds.length < 2) {
    return null
  }
  const groupId = newId('group')
  for (const id of sectionIds) {
    const section = findSection(page, id)
    if (section) {
      section.groupId = groupId
    }
  }
  return groupId
}

export function ungroupSections(page: { sections: Section[] }, sectionIds: string[]): boolean {
  let changed = false
  for (const id of sectionIds) {
    const section = findSection(page, id)
    if (section?.groupId) {
      section.groupId = null
      changed = true
    }
  }
  return changed
}
