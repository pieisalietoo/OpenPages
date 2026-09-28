<script setup lang="ts">
import {
  AArrowDown,
  AArrowUp,
  Bold,
  CodeXml,
  Italic,
  Strikethrough,
  TextInitial,
  Trash2,
  Underline,
} from 'lucide-vue-next'
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, useSlots } from 'vue'
import { createI18n, type OpenPagesI18n } from '../i18n'
import { OPEN_PAGES_I18N } from '../i18n/keys'
import { resolveTemplate } from '../model/bindings'
import type { OpenPagesDocument } from '../model/document'
import {
  applyCatalogFontSelection,
  BUILTIN_FONTS,
  matchCatalogFont,
  type OpenPagesFont,
} from '../model/fonts'
import { relativeExclusionsForHost } from '../model/runaround'
import { sanitizeTextHtml } from '../model/sanitize-html'
import {
  bumpTextSectionFonts,
  deleteSection,
  moveSection,
  type NudgeKey,
  nudgeSection,
  resizeSection,
  type Section,
} from '../model/section'
import { type SnapGuide, snapSectionPosition } from '../model/snap'
import {
  deletePlainRange,
  insertPlainText,
  plainTextLength,
  plainTextOf,
  setDomSelectionFromPlainOffsets,
  wordRangeAtOffset,
} from '../model/text-edit/plain-offset'
import {
  applyInlineStyleToPlainRange,
  bumpFontSizeInPlainRange,
  wrapPlainRangeWithCommand,
} from '../model/text-edit/plain-style'
import {
  applyInlineStyleToElement,
  applyInlineStyleToRange,
  applyInlineStyleToSelection,
  bumpFontSizesInSelection,
  getEditableSelectionRange,
} from '../model/text-inline'
import {
  type CaretAffinity,
  caretLeftInLineEl,
  caretRectForOffset,
  createCanvasMeasurer,
  fitTextFrame,
  hitTestClientPoint,
  htmlToPlainText,
  inlineRunsFromHtml,
  type LaidOutLine,
  lineIndexForOffset,
  lineRangeAtOffset,
  moveCaretVertically,
  selectionRects,
  snapCaretAfterEdit,
} from '../model/text-layout'

const props = withDefaults(
  defineProps<{
    document: OpenPagesDocument
    pageId: string
    selectedSectionId?: string | null
    selectedSectionIds?: string[]
    hoveredSectionId?: string | null
    snapEnabled?: boolean
    showHidden?: boolean
    fonts?: OpenPagesFont[]
    i18n?: OpenPagesI18n
  }>(),
  {
    snapEnabled: true,
    showHidden: false,
    fonts: () => BUILTIN_FONTS,
  },
)

const i18n = inject(OPEN_PAGES_I18N, null) ?? props.i18n ?? createI18n()
const slots = useSlots()

const emit = defineEmits<{
  select: [sectionId: string, options: { additive: boolean }]
  clearSelection: []
  change: [payload?: { transient?: boolean }]
  editingChange: [editing: boolean]
}>()

type DragMode = 'move' | 'resize'

const drag = ref<{
  mode: DragMode
  sectionId: string
  startX: number
  startY: number
  originX: number
  originY: number
  originW: number
  originH: number
  moved: boolean
} | null>(null)

const snapGuides = ref<SnapGuide[]>([])

const snapTargetIds = computed(() => {
  const ids = new Set<string>()
  for (const guide of snapGuides.value) {
    for (const id of guide.targetIds) ids.add(id)
  }
  return ids
})

const page = computed(() => {
  const found = props.document.pages.find((entry) => entry.id === props.pageId)
  if (!found) {
    throw new Error(`Page not found: ${props.pageId}`)
  }
  return found
})

const selectedIds = computed(() => {
  if (props.selectedSectionIds) {
    return props.selectedSectionIds
  }
  return props.selectedSectionId ? [props.selectedSectionId] : []
})

const visibleSections = computed(() =>
  props.showHidden ? page.value.sections : page.value.sections.filter((section) => !section.hidden),
)

const pageStyle = computed(() => ({
  width: `${page.value.width}px`,
  height: `${page.value.height}px`,
}))

const marginStyle = computed(() => ({
  top: `${page.value.margins.top}px`,
  right: `${page.value.margins.right}px`,
  bottom: `${page.value.margins.bottom}px`,
  left: `${page.value.margins.left}px`,
}))

function guideStyle(guide: { orientation: 'horizontal' | 'vertical'; offset: number }) {
  if (guide.orientation === 'vertical') {
    return { left: `${guide.offset}px` }
  }
  return { top: `${guide.offset}px` }
}

function sectionStyle(section: Section) {
  const style: Record<string, string> = {
    left: `${section.x}px`,
    top: `${section.y}px`,
    width: `${section.width}px`,
    height: `${section.height}px`,
    backgroundColor: section.backgroundColor,
    color: section.color,
  }
  if (section.type === 'runaround') {
    // Chrome comes from .op-section--runaround; keep model border off the box.
  } else {
    style.borderColor = section.borderColor
    style.borderWidth = `${section.borderWidth}px`
    style.borderStyle = section.borderWidth > 0 ? 'solid' : 'none'
  }
  if (section.type === 'text' || section.type === 'headline') {
    style.fontFamily = section.fontFamily
    style.fontSize = `${section.fontSize}px`
    style.fontWeight = section.fontBold ? '700' : '400'
    style.fontStyle = section.fontItalic ? 'italic' : 'normal'
    const decorations: string[] = []
    if (section.fontUnderline) decorations.push('underline')
    if (section.fontStrike) decorations.push('line-through')
    style.textDecoration = decorations.length ? decorations.join(' ') : 'none'
    // Columns + wrap come from the line-box engine, not CSS multi-column / floats.
  }
  return style
}

const textMeasurer = createCanvasMeasurer()
const COLUMN_GAP_PX = 16

const editingSectionId = ref<string | null>(null)
/** While editing: live layout WYSIWYG vs raw HTML textarea. */
const textEditMode = ref<'wysiwyg' | 'source'>('wysiwyg')
/** Plain-text caret offset (textContent order) while in WYSIWYG mode. */
const editCaretOffset = ref(0)
const editAnchorOffset = ref(0)
/** Soft-wrap boundary: upstream = EOL of earlier line; downstream = SOL of later. */
const editCaretAffinity = ref<CaretAffinity>('downstream')
/** True while an IME composition session is active (skip keydown intercept). */
const imeComposing = ref(false)
/** Plain range captured on Ctrl/Cmd+V before CE/input can collapse the selection. */
const pendingPasteRange = ref<{ start: number; end: number } | null>(null)
/**
 * When true, ignore CE→model offset sync from selectionchange.
 * Layout-driven caret must not be overwritten by the flat contenteditable selection.
 */
const suppressSelectionSync = ref(false)
/** Pointer-drag text selection in live WYSIWYG (hit-tested against line boxes). */
const pointerSelecting = ref(false)
/** Multi-click tracker — native click/dblclick often never fire after preventDefault on pointerdown. */
const textClickGesture = ref<{
  t: number
  originX: number
  originY: number
  count: number
} | null>(null)
const savedEditRange = ref<Range | null>(null)
const chromeDraftFontSize = ref<number | null>(null)
const chromeDraftLineHeight = ref<number | null>(null)
const chromeDraftFontId = ref<string | null>(null)

/** Max gap between consecutive presses in one gesture (browser-like). */
const MULTI_CLICK_MS = 600
/** Drift allowed from the first press of the gesture. */
const MULTI_CLICK_PX = 28

function textMultiClickCount(clientX: number, clientY: number): number {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const prev = textClickGesture.value
  const near =
    prev != null &&
    now - prev.t <= MULTI_CLICK_MS &&
    Math.hypot(clientX - prev.originX, clientY - prev.originY) <= MULTI_CLICK_PX
  const count = near ? prev.count + 1 : 1
  textClickGesture.value = {
    t: now,
    originX: near ? prev.originX : clientX,
    originY: near ? prev.originY : clientY,
    count,
  }
  return count
}

function placeCaretAt(
  offset: number,
  opts?: { drag?: boolean; pointerId?: number; affinity?: CaretAffinity },
) {
  editCaretOffset.value = offset
  editAnchorOffset.value = offset
  editCaretAffinity.value = opts?.affinity ?? 'downstream'
  clearChromeDrafts()
  pointerSelecting.value = Boolean(opts?.drag)
  const el = getEditEl()
  el?.focus()
  if (opts?.drag && opts.pointerId != null) {
    try {
      el?.setPointerCapture?.(opts.pointerId)
    } catch {
      // ignore
    }
  }
  placeCeSelection()
}

function selectWordAt(section: Section, offset: number) {
  if (section.type !== 'text' && section.type !== 'headline') return
  const word = wordRangeAtOffset(plainTextOf(section.content), offset)
  const layout = lineLayouts.value.get(section.id)
  const line = lineRangeAtOffset(layout?.lines ?? [], offset, editCaretAffinity.value)
  // Model plain has no separators between blocks (`twoClosing`); clamp to the line.
  const start = Math.max(word.start, line.start)
  const end = Math.min(word.end, line.end)
  editAnchorOffset.value = start
  editCaretOffset.value = end
  editCaretAffinity.value = end === line.end && end > line.start ? 'upstream' : 'downstream'
  pointerSelecting.value = false
  getEditEl()?.focus()
  placeCeSelection()
}

function selectLineAt(section: Section, offset: number) {
  if (section.type !== 'text' && section.type !== 'headline') return
  const layout = lineLayouts.value.get(section.id)
  const range = lineRangeAtOffset(layout?.lines ?? [], offset, editCaretAffinity.value)
  editAnchorOffset.value = range.start
  editCaretOffset.value = range.end
  editCaretAffinity.value = 'upstream'
  pointerSelecting.value = false
  getEditEl()?.focus()
  placeCeSelection()
}

function onDocumentSelectionChange() {
  const el = getEditEl()
  if (!el) return
  // While the chrome fields have focus, ignore selection churn from apply/reselect.
  if (chromeFormHasFocus()) return

  const sel = el.ownerDocument.getSelection()
  // Do not mirror the flat CE caret into layout offsets — CE geometry ≠ line boxes.
  // Model offsets are owned by pointer hit-test + keyboard handlers.

  const range = getEditableSelectionRange(el)
  const marked = el.querySelector('[data-op-chrome-sel]')

  if (range) {
    const stillOnMark =
      marked != null &&
      (marked === range.commonAncestorContainer || marked.contains(range.commonAncestorContainer))
    if (!stillOnMark) clearChromeSelectionMarks(el)
    savedEditRange.value = range.cloneRange()
    return
  }

  if (!sel || sel.rangeCount === 0) return
  const caret = sel.getRangeAt(0)
  if (!el.contains(caret.commonAncestorContainer)) return
  // Click / caret inside the editor discards the chrome stand-in.
  clearChromeSelectionMarks(el)
  savedEditRange.value = null
}

function placeCeSelection(_anchor = editAnchorOffset.value, focus = editCaretOffset.value) {
  const el = getEditEl()
  if (!el) return
  // Keep the native CE selection collapsed so the browser does not paint a
  // flat-geometry highlight on top of the layout selection overlay.
  suppressSelectionSync.value = true
  setDomSelectionFromPlainOffsets(el, focus, focus)
  void nextTick(() => {
    suppressSelectionSync.value = false
  })
}

function wysiwygHit(
  section: Section,
  clientX: number,
  clientY: number,
): { offset: number; affinity: CaretAffinity } | null {
  if (section.type !== 'text' && section.type !== 'headline') return null
  const sectionEl = document.querySelector(
    `[data-op-section="${section.id}"]`,
  ) as HTMLElement | null
  if (!sectionEl) return null
  const lineEls = Array.from(sectionEl.querySelectorAll('[data-op-line]')) as HTMLElement[]
  if (!lineEls.length) return null
  const layout = lineLayouts.value.get(section.id)
  const fontSize = layout?.fontSize ?? section.fontSize
  const style = {
    fontFamily: section.fontFamily,
    fontSize,
    fontBold: section.fontBold,
    fontItalic: section.fontItalic,
  }
  // CSS boxes pick the line (columns / paint drift); layout lines supply model offsets.
  return hitTestClientPoint(
    lineEls,
    clientX,
    clientY,
    { measure: textMeasurer, style },
    layout?.lines,
  )
}

function onWysiwygPointerDown(section: Section, event: PointerEvent) {
  if (textEditMode.value !== 'wysiwyg' || event.button !== 0) return
  if (section.type !== 'text' && section.type !== 'headline') return
  // Prevent the flat CE from placing its own caret (wrong geometry vs line boxes).
  event.preventDefault()
  const hit = wysiwygHit(section, event.clientX, event.clientY)
  if (hit == null) return
  const { offset, affinity } = hit

  // Own counter only — browser event.detail is unreliable after preventDefault.
  const clickCount = textMultiClickCount(event.clientX, event.clientY)

  // Cycle like the browser: 1 caret → 2 word → 3 line → 4 caret (gesture ends).
  if (clickCount >= 4) {
    placeCaretAt(offset, { affinity })
    textClickGesture.value = null
    return
  }
  if (clickCount === 3) {
    editCaretAffinity.value = affinity
    selectLineAt(section, offset)
    return
  }
  if (clickCount === 2) {
    editCaretAffinity.value = affinity
    selectWordAt(section, offset)
    return
  }

  // count === 1
  if (event.shiftKey) {
    editCaretOffset.value = offset
    editCaretAffinity.value = affinity
    pointerSelecting.value = false
    getEditEl()?.focus()
    placeCeSelection()
    return
  }
  placeCaretAt(offset, { drag: true, pointerId: event.pointerId, affinity })
}

function onWysiwygPointerMove(section: Section, event: PointerEvent) {
  if (!pointerSelecting.value || textEditMode.value !== 'wysiwyg') return
  if ((event.buttons & 1) === 0) return
  const hit = wysiwygHit(section, event.clientX, event.clientY)
  if (hit == null) return
  editCaretOffset.value = hit.offset
  editCaretAffinity.value = hit.affinity
  placeCeSelection()
}

function onWysiwygPointerUp(event: PointerEvent) {
  if (!pointerSelecting.value) return
  pointerSelecting.value = false
  const el = getEditEl()
  try {
    el?.releasePointerCapture?.(event.pointerId)
  } catch {
    // ignore
  }
  placeCeSelection()
}

function syncCeFromModel() {
  const el = getEditEl()
  const section = textChromeSection.value
  if (!el || !section) return
  suppressSelectionSync.value = true
  const content = section.content
  if (/[<>]/.test(content)) el.innerHTML = content
  else el.textContent = content
  // Collapsed caret only — layout overlay owns the visible selection.
  setDomSelectionFromPlainOffsets(el, editCaretOffset.value, editCaretOffset.value)
  void nextTick(() => {
    suppressSelectionSync.value = false
  })
}

function wysiwygPlainRange(): { start: number; end: number } | null {
  const start = Math.min(editAnchorOffset.value, editCaretOffset.value)
  const end = Math.max(editAnchorOffset.value, editCaretOffset.value)
  if (end <= start) return null
  return { start, end }
}

function applyModelInlineStyle(style: {
  fontFamily?: string
  fontSize?: number
  lineHeight?: number
  color?: string
}): boolean {
  const section = textChromeSection.value
  const range = wysiwygPlainRange()
  if (!section || !range) return false
  section.content = applyInlineStyleToPlainRange(section.content, range.start, range.end, style)
  emit('change', { transient: true })
  void nextTick(() => syncCeFromModel())
  return true
}

function clearChromeDrafts() {
  chromeDraftFontSize.value = null
  chromeDraftLineHeight.value = null
  chromeDraftFontId.value = null
}

function clearChromeSelectionMarks(root?: HTMLElement | null) {
  const el = root ?? getEditEl()
  if (!el) return
  for (const node of Array.from(el.querySelectorAll('[data-op-chrome-sel]'))) {
    node.removeAttribute('data-op-chrome-sel')
  }
  // Do not clear chrome drafts here — selectionchange after syncCeFromModel would
  // snap the size/family controls back to section defaults while a model selection
  // is still active.
}

function getEditEl(): HTMLElement | null {
  if (!editingSectionId.value || textEditMode.value !== 'wysiwyg') return null
  return document.querySelector(
    `[data-op-section="${editingSectionId.value}"] [data-op-text-edit]`,
  ) as HTMLElement | null
}

function getSourceEl(): HTMLTextAreaElement | null {
  if (!editingSectionId.value || textEditMode.value !== 'source') return null
  return document.querySelector(
    `[data-op-section="${editingSectionId.value}"] [data-op-text-source]`,
  ) as HTMLTextAreaElement | null
}

onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', onDocumentSelectionChange)
  window.removeEventListener('keydown', onWindowKeydown)
})

const textChromeSection = computed(() => {
  if (!editingSectionId.value) return null
  const section = page.value.sections.find((entry) => entry.id === editingSectionId.value)
  if (!section || (section.type !== 'text' && section.type !== 'headline')) return null
  return section
})

function textChromeStyle() {
  const section = textChromeSection.value
  if (!section) return {}
  return {
    left: `${section.x}px`,
    top: `${section.y}px`,
    width: `${Math.max(section.width, 260)}px`,
    transform: 'translateY(calc(-100% - 8px))',
  }
}

const showSelectionChrome = computed(
  () =>
    Boolean(slots['selection-chrome']) &&
    selectedIds.value.length > 0 &&
    !editingSectionId.value &&
    !drag.value?.moved,
)

function selectionChromeStyle() {
  const selected = page.value.sections.filter((s) => selectedIds.value.includes(s.id))
  if (!selected.length) return {}
  const left = Math.min(...selected.map((s) => s.x))
  const top = Math.min(...selected.map((s) => s.y))
  const right = Math.max(...selected.map((s) => s.x + s.width))
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${Math.max(right - left, 260)}px`,
    transform: 'translateY(calc(-100% - 8px))',
  }
}

function isEditing(section: Section): boolean {
  return editingSectionId.value === section.id
}

async function beginTextEdit(section: Section) {
  if (section.locked || (section.type !== 'text' && section.type !== 'headline')) return
  if (isEditing(section)) return
  editingSectionId.value = section.id
  textEditMode.value = 'wysiwyg'
  const content = sanitizeTextHtml(section.content)
  section.content = content
  editCaretOffset.value = plainTextLength(content)
  editAnchorOffset.value = editCaretOffset.value
  emit('editingChange', true)
  document.addEventListener('selectionchange', onDocumentSelectionChange)
  await nextTick()
  syncCeFromModel()
  getEditEl()?.focus()
}

function endTextEdit() {
  document.removeEventListener('selectionchange', onDocumentSelectionChange)
  if (textEditMode.value === 'source') commitSourceSanitize()
  else syncEditContent()
  editingSectionId.value = null
  textEditMode.value = 'wysiwyg'
  editCaretOffset.value = 0
  editAnchorOffset.value = 0
  savedEditRange.value = null
  clearChromeDrafts()
  emit('editingChange', false)
}

function onCompositionStart() {
  imeComposing.value = true
}

function onCompositionEnd() {
  imeComposing.value = false
  syncEditContent()
  const section = textChromeSection.value
  if (section) {
    const len = plainTextLength(section.content)
    editCaretOffset.value = len
    editAnchorOffset.value = len
  }
}

function onTextEditInput() {
  // Bridge for paste / IME / chrome execCommand — keep model + caret in sync.
  if (imeComposing.value) return
  syncEditContent()
  const section = textChromeSection.value
  if (section) {
    const len = plainTextLength(section.content)
    editCaretOffset.value = Math.min(editCaretOffset.value, len)
    // Keep the model selection: collapsing here makes Ctrl+V paste insert without
    // replacing (CE selection is always collapsed; only the overlay holds the range).
    editAnchorOffset.value = Math.min(editAnchorOffset.value, len)
  }
}

function onSourceInput() {
  // Persist raw markup only — never sanitize/rewrite while typing (that jumps the caret).
  syncEditContent()
}

async function toggleTextEditMode() {
  if (textEditMode.value === 'source') commitSourceSanitize()
  else syncEditContent()
  textEditMode.value = textEditMode.value === 'wysiwyg' ? 'source' : 'wysiwyg'
  await nextTick()
  if (textEditMode.value === 'source') {
    const ta = getSourceEl()
    if (ta) {
      ta.value = textChromeSection.value?.content ?? ''
      ta.focus()
    }
  } else {
    const section = textChromeSection.value
    if (section) {
      editCaretOffset.value = plainTextLength(section.content)
      editAnchorOffset.value = editCaretOffset.value
    }
    syncCeFromModel()
    getEditEl()?.focus()
  }
}

function applyWysiwygContent(html: string, caret: number, _affinity: CaretAffinity = 'downstream') {
  const section = textChromeSection.value
  if (!section) return
  section.content = html
  const len = plainTextLength(html)
  const lines = lineLayouts.value.get(section.id)?.lines ?? []
  const snapped = snapCaretAfterEdit(lines, Math.min(Math.max(0, caret), len))
  editCaretOffset.value = snapped.offset
  editAnchorOffset.value = snapped.offset
  editCaretAffinity.value = snapped.affinity
  emit('change', { transient: true })
  void nextTick(() => syncCeFromModel())
}

function onWysiwygCopy(event: ClipboardEvent) {
  if (textEditMode.value !== 'wysiwyg') return
  const section = textChromeSection.value
  const range = wysiwygPlainRange()
  if (!section || !range) return
  event.preventDefault()
  const text = plainTextOf(section.content).slice(range.start, range.end)
  event.clipboardData?.setData('text/plain', text)
}

function onWysiwygCut(event: ClipboardEvent) {
  if (textEditMode.value !== 'wysiwyg') return
  const section = textChromeSection.value
  const range = wysiwygPlainRange()
  if (!section || !range) return
  event.preventDefault()
  const text = plainTextOf(section.content).slice(range.start, range.end)
  event.clipboardData?.setData('text/plain', text)
  applyWysiwygContent(deletePlainRange(section.content, range.start, range.end), range.start)
}

function onWysiwygPaste(event: ClipboardEvent) {
  if (textEditMode.value !== 'wysiwyg') return
  const section = textChromeSection.value
  if (!section) return
  event.preventDefault()
  const text = event.clipboardData?.getData('text/plain') ?? ''
  if (!text) {
    pendingPasteRange.value = null
    return
  }
  const saved = pendingPasteRange.value
  pendingPasteRange.value = null
  const start = saved ? saved.start : Math.min(editAnchorOffset.value, editCaretOffset.value)
  const end = saved ? saved.end : Math.max(editAnchorOffset.value, editCaretOffset.value)
  let html = section.content
  if (end > start) html = deletePlainRange(html, start, end)
  html = insertPlainText(html, start, text)
  applyWysiwygContent(html, start + text.length)
}

function onWysiwygKeydown(event: KeyboardEvent) {
  if (textEditMode.value !== 'wysiwyg') return
  if (imeComposing.value) return

  const section = textChromeSection.value
  if (!section) return

  if (event.key === 'Escape') {
    event.preventDefault()
    endTextEdit()
    return
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
    event.preventDefault()
    editAnchorOffset.value = 0
    editCaretOffset.value = plainTextLength(section.content)
    placeCeSelection()
    return
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
    // Remember the overlay selection before CE/input can collapse it.
    pendingPasteRange.value = {
      start: Math.min(editAnchorOffset.value, editCaretOffset.value),
      end: Math.max(editAnchorOffset.value, editCaretOffset.value),
    }
    return
  }

  if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    const layout = lineLayouts.value.get(section.id)
    const lines = layout?.lines ?? []
    const len = plainTextLength(section.content)
    let next = editCaretOffset.value
    let affinity: CaretAffinity = 'downstream'
    if (event.ctrlKey || event.metaKey) {
      next = event.key === 'Home' ? 0 : len
      affinity = event.key === 'Home' ? 'downstream' : 'upstream'
    } else if (lines.length) {
      const idx = lineIndexForOffset(lines, next, editCaretAffinity.value)
      const line = lines[idx]
      if (line) {
        next = event.key === 'Home' ? line.modelStart : line.modelEnd
        affinity = event.key === 'Home' ? 'downstream' : 'upstream'
      }
    } else {
      next = event.key === 'Home' ? 0 : len
      affinity = event.key === 'Home' ? 'downstream' : 'upstream'
    }
    editCaretOffset.value = next
    editCaretAffinity.value = affinity
    if (!event.shiftKey) editAnchorOffset.value = next
    placeCeSelection()
    return
  }

  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault()
    const layout = lineLayouts.value.get(section.id)
    const lines = layout?.lines ?? []
    const len = plainTextLength(section.content)
    let next = editCaretOffset.value
    let affinity = editCaretAffinity.value
    if (lines.length) {
      const idx = lineIndexForOffset(lines, next, affinity)
      const line = lines[idx]
      if (line) {
        if (event.key === 'ArrowRight') {
          if (next < line.modelEnd) {
            next += 1
            affinity = next === line.modelEnd ? 'upstream' : 'downstream'
          } else if (idx < lines.length - 1) {
            if (affinity === 'upstream') {
              affinity = 'downstream'
            } else {
              next = Math.min(len, next + 1)
              affinity = 'downstream'
            }
          } else {
            next = Math.min(len, next + 1)
            affinity = 'downstream'
          }
        } else {
          if (next > line.modelStart) {
            next -= 1
            affinity = 'downstream'
          } else if (idx > 0) {
            if (affinity === 'downstream') {
              affinity = 'upstream'
            } else {
              next = Math.max(0, next - 1)
              affinity = 'upstream'
            }
          } else {
            next = Math.max(0, next - 1)
            affinity = 'downstream'
          }
        }
      }
    } else {
      const delta = event.key === 'ArrowLeft' ? -1 : 1
      next = Math.max(0, Math.min(len, editCaretOffset.value + delta))
      affinity = 'downstream'
    }
    editCaretOffset.value = next
    editCaretAffinity.value = affinity
    if (!event.shiftKey) editAnchorOffset.value = next
    placeCeSelection()
    return
  }

  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault()
    const layout = lineLayouts.value.get(section.id)
    const lines = layout?.lines ?? []
    if (!lines.length) return
    const fontSize = layout?.fontSize ?? section.fontSize
    const base = {
      fontFamily: section.fontFamily,
      fontSize,
      fontBold: section.fontBold,
      fontItalic: section.fontItalic,
    }
    const next = moveCaretVertically(
      lines,
      editCaretOffset.value,
      event.key === 'ArrowUp' ? 'up' : 'down',
      textMeasurer,
      base,
    )
    editCaretOffset.value = next
    editCaretAffinity.value = 'downstream'
    if (!event.shiftKey) editAnchorOffset.value = next
    placeCeSelection()
    return
  }

  if (event.ctrlKey || event.metaKey || event.altKey) return

  const start = Math.min(editAnchorOffset.value, editCaretOffset.value)
  const end = Math.max(editAnchorOffset.value, editCaretOffset.value)

  if (event.key.length === 1) {
    event.preventDefault()
    let html = section.content
    if (end > start) html = deletePlainRange(html, start, end)
    html = insertPlainText(html, start, event.key)
    applyWysiwygContent(html, start + event.key.length)
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    let html = section.content
    if (end > start) html = deletePlainRange(html, start, end)
    html = insertPlainText(html, start, '\n')
    applyWysiwygContent(html, start + 1)
    return
  }

  if (event.key === 'Backspace') {
    event.preventDefault()
    if (end > start) {
      applyWysiwygContent(deletePlainRange(section.content, start, end), start)
      return
    }
    if (start <= 0) return
    applyWysiwygContent(deletePlainRange(section.content, start - 1, start), start - 1)
    return
  }

  if (event.key === 'Delete') {
    event.preventDefault()
    if (end > start) {
      applyWysiwygContent(deletePlainRange(section.content, start, end), start)
      return
    }
    const len = plainTextLength(section.content)
    if (start >= len) return
    applyWysiwygContent(deletePlainRange(section.content, start, start + 1), start)
  }
}

function wysiwygSelectionRects(section: Section) {
  if (section.type !== 'text' && section.type !== 'headline') return []
  const start = editAnchorOffset.value
  const end = editCaretOffset.value
  if (start === end) return []
  const layout = lineLayouts.value.get(section.id)
  const lines = layout?.lines ?? []
  const fontSize = layout?.fontSize ?? section.fontSize
  return selectionRects(lines, start, end, textMeasurer, {
    fontFamily: section.fontFamily,
    fontSize,
    fontBold: section.fontBold,
    fontItalic: section.fontItalic,
  })
}

function wysiwygCaretStyle(section: Section) {
  if (section.type !== 'text' && section.type !== 'headline') return { display: 'none' }
  if (editAnchorOffset.value !== editCaretOffset.value) return { display: 'none' }
  const layout = lineLayouts.value.get(section.id)
  const lines = layout?.lines ?? []
  const fontSize = layout?.fontSize ?? section.fontSize
  const base = {
    fontFamily: section.fontFamily,
    fontSize,
    fontBold: section.fontBold,
    fontItalic: section.fontItalic,
  }
  const sectionEl = document.querySelector(
    `[data-op-section="${section.id}"]`,
  ) as HTMLElement | null
  if (sectionEl) {
    const lineEls = Array.from(sectionEl.querySelectorAll('[data-op-line]')) as HTMLElement[]
    const offset = editCaretOffset.value
    const affinity = editCaretAffinity.value
    for (let i = 0; i < lineEls.length; i++) {
      const el = lineEls[i]
      const layoutLine = lines[i]
      if (!el || !layoutLine) continue
      const isLast = i === lineEls.length - 1
      const atEnd = offset === layoutLine.modelEnd
      const owns = offset < layoutLine.modelEnd || (atEnd && (isLast || affinity === 'upstream'))
      if (owns) {
        const sr = sectionEl.getBoundingClientRect()
        const lr = el.getBoundingClientRect()
        const local = Math.max(0, offset - layoutLine.modelStart)
        const left = caretLeftInLineEl(
          el,
          local,
          { measure: textMeasurer, style: base },
          layoutLine,
        )
        return {
          left: `${lr.left - sr.left + left}px`,
          top: `${lr.top - sr.top}px`,
          height: `${Math.max(1, lr.height)}px`,
        }
      }
    }
  }
  const rect = caretRectForOffset(
    lines,
    editCaretOffset.value,
    textMeasurer,
    base,
    editCaretAffinity.value,
  ) ?? {
    x: 0,
    y: 0,
    height: Math.max(1, fontSize * section.lineHeight),
  }
  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    height: `${rect.height}px`,
  }
}

function onChromeDeleteSection() {
  const section = textChromeSection.value
  if (!section || section.locked) return
  const id = section.id
  document.removeEventListener('selectionchange', onDocumentSelectionChange)
  editingSectionId.value = null
  textEditMode.value = 'wysiwyg'
  editCaretOffset.value = 0
  editAnchorOffset.value = 0
  savedEditRange.value = null
  clearChromeDrafts()
  emit('editingChange', false)
  deleteSection(page.value, id)
  emit('clearSelection')
  emit('change')
}

function saveEditSelection() {
  const el = getEditEl()
  if (!el) return
  const sel = el.ownerDocument.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
  const range = sel.getRangeAt(0)
  if (!el.contains(range.commonAncestorContainer)) return
  // Only overwrite when we still have a real edit selection — never clear on input focus.
  savedEditRange.value = range.cloneRange()
}

function focusEdit() {
  getEditEl()?.focus()
}

function runExecCommand(command: string, value?: string) {
  const exec = (
    document as Document & {
      execCommand?: (commandId: string, showUI?: boolean, value?: string) => boolean
    }
  ).execCommand
  if (typeof exec !== 'function') return false
  return value === undefined
    ? exec.call(document, command)
    : exec.call(document, command, false, value)
}

function syncEditContent() {
  const section = textChromeSection.value
  if (!section) return
  if (textEditMode.value === 'source') {
    const ta = getSourceEl()
    if (!ta) return
    section.content = ta.value
    emit('change')
    return
  }
  const el = getEditEl()
  if (!el) return
  const cleaned = sanitizeTextHtml(el.innerHTML)
  if (cleaned !== el.innerHTML) el.innerHTML = cleaned
  section.content = cleaned.replace(/\s*data-op-chrome-sel(?:="[^"]*")?/g, '')
  const marked = el.querySelector('[data-op-chrome-sel]')
  if (marked) rememberStyledSelection(marked)
  emit('change')
}

/** Sanitize source markup when leaving source mode (toggle / end edit). */
function commitSourceSanitize() {
  const section = textChromeSection.value
  if (!section) return
  const ta = getSourceEl()
  const raw = ta?.value ?? section.content
  const cleaned = sanitizeTextHtml(raw)
  section.content = cleaned
  if (ta && ta.value !== cleaned) ta.value = cleaned
  emit('change')
}

function rememberStyledSelection(node: Node) {
  const el = getEditEl()
  const doc = node.ownerDocument
  if (!el || !doc || !el.contains(node)) return
  if (node instanceof HTMLElement) {
    for (const prev of Array.from(el.querySelectorAll('[data-op-chrome-sel]'))) {
      if (prev !== node) prev.removeAttribute('data-op-chrome-sel')
    }
    node.setAttribute('data-op-chrome-sel', '')
  }
  const next = doc.createRange()
  next.selectNodeContents(node)
  savedEditRange.value = next.cloneRange()
  // Keep focus on chrome form controls; only mirror a live selection when editing the text.
  if (chromeFormHasFocus()) return
  try {
    const sel = doc.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(next)
  } catch {
    // ignore
  }
}

function chromeFormHasFocus(): boolean {
  const active = document.activeElement
  return Boolean(
    active?.closest?.(
      '[data-op-text-chrome] input, [data-op-text-chrome] select, [data-op-text-chrome] button',
    ),
  )
}

function ensureSelectionHighlight() {
  const el = getEditEl()
  if (!el) return
  const existing = el.querySelector('[data-op-chrome-sel]')
  if (existing) {
    rememberStyledSelection(existing)
    return
  }
  let range = getEditableSelectionRange(el)
  if (!range) {
    const saved = savedEditRange.value
    if (saved && !saved.collapsed && el.contains(saved.commonAncestorContainer)) {
      range = saved
    }
  }
  if (!range || range.collapsed) return
  const span = applyInlineStyleToRange(range, {}, { reselect: false })
  if (span) {
    rememberStyledSelection(span)
    const section = textChromeSection.value
    if (section) {
      chromeDraftFontSize.value = section.fontSize
      chromeDraftLineHeight.value = section.lineHeight
    }
  }
}

function restoreEditSelection() {
  const el = getEditEl()
  const range = savedEditRange.value
  if (!el || !range) return false
  if (chromeFormHasFocus()) return false
  try {
    if (!el.contains(range.commonAncestorContainer)) return false
    el.focus()
    const sel = el.ownerDocument.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    return Boolean(getEditableSelectionRange(el))
  } catch {
    return false
  }
}

function onChromeMouseDown(event: MouseEvent) {
  // Leaving the line-box surface ends the multi-click gesture (Home/chrome/etc.).
  textClickGesture.value = null
  saveEditSelection()
  const target = event.target as HTMLElement | null
  if (target?.closest('button')) {
    event.preventDefault()
    ensureSelectionHighlight()
    return
  }
  if (target?.closest('input, select')) {
    ensureSelectionHighlight()
  }
}

function applyChromeInlineStyle(style: {
  fontFamily?: string
  fontSize?: number
  lineHeight?: number
  color?: string
}): boolean {
  const el = getEditEl()

  // CE / chrome-mark path first (saved selection stand-in while form controls have focus).
  if (el) {
    const marked = el.querySelector('[data-op-chrome-sel]')
    if (marked instanceof HTMLElement) {
      applyInlineStyleToElement(marked, style)
      rememberStyledSelection(marked)
      syncEditContent()
      return true
    }

    let span: HTMLElement | null = null
    if (!chromeFormHasFocus() && restoreEditSelection() && getEditableSelectionRange(el)) {
      const live = getEditableSelectionRange(el)
      if (live) span = applyInlineStyleToRange(live, style, { reselect: true })
    } else {
      const saved = savedEditRange.value
      if (saved) {
        try {
          if (el.contains(saved.commonAncestorContainer)) {
            span = applyInlineStyleToRange(saved, style, { reselect: !chromeFormHasFocus() })
          }
        } catch {
          span = null
        }
      }
    }
    if (span) {
      rememberStyledSelection(span)
      syncEditContent()
      return true
    }
  }

  // Live WYSIWYG model-offset path.
  return applyModelInlineStyle(style)
}

function onChromeFontSize(raw: string) {
  const section = textChromeSection.value
  if (!section) return
  const fontSize = Number(raw)
  if (!Number.isFinite(fontSize)) return
  if (applyChromeInlineStyle({ fontSize })) {
    chromeDraftFontSize.value = Math.max(1, fontSize)
    return
  }
  section.fontSize = Math.max(1, fontSize)
  chromeDraftFontSize.value = null
  emit('change')
}

function onChromeLineHeight(raw: string) {
  const section = textChromeSection.value
  if (!section) return
  const lineHeight = Number(raw)
  if (!Number.isFinite(lineHeight)) return
  if (applyChromeInlineStyle({ lineHeight })) {
    chromeDraftLineHeight.value = Math.max(0.5, lineHeight)
    return
  }
  section.lineHeight = Math.max(0.5, lineHeight)
  chromeDraftLineHeight.value = null
  emit('change')
}

function onChromeColor(raw: string) {
  const section = textChromeSection.value
  if (!section) return
  if (applyChromeInlineStyle({ color: raw })) {
    return
  }
  section.color = raw
  emit('change')
}

function onChromeFamily(raw: string) {
  const section = textChromeSection.value
  if (!section) return
  // Prefer catalog id (unique) so bold/regular faces that share a CSS family can differ.
  const byId = props.fonts.find((f) => f.id === raw)
  const patch = byId
    ? applyCatalogFontSelection(byId)
    : { fontFamily: raw, fontBold: section.fontBold }
  if (applyChromeInlineStyle({ fontFamily: patch.fontFamily })) {
    section.fontBold = patch.fontBold
    chromeDraftFontId.value = byId?.id ?? raw
    return
  }
  section.fontFamily = patch.fontFamily
  section.fontBold = patch.fontBold
  chromeDraftFontId.value = null
  emit('change')
}

function chromeSelectedFontId(): string {
  const section = textChromeSection.value
  if (!section) return ''
  if (chromeDraftFontId.value) return chromeDraftFontId.value
  return (
    matchCatalogFont(props.fonts, {
      family: section.fontFamily,
      fontBold: section.fontBold,
    })?.id ?? ''
  )
}

function onChromeCommand(command: 'bold' | 'italic' | 'underline' | 'strikeThrough') {
  const section = textChromeSection.value
  const range = wysiwygPlainRange()
  if (section && range) {
    section.content = wrapPlainRangeWithCommand(section.content, range.start, range.end, command)
    emit('change', { transient: true })
    void nextTick(() => syncCeFromModel())
    return
  }
  restoreEditSelection()
  focusEdit()
  runExecCommand(command)
  syncEditContent()
  const el = getEditEl()
  const live = el ? getEditableSelectionRange(el) : null
  if (live) {
    savedEditRange.value = live.cloneRange()
  } else {
    const marked = el?.querySelector('[data-op-chrome-sel]')
    if (marked) rememberStyledSelection(marked)
  }
}

function onChromeFontBump(delta: number) {
  const section = textChromeSection.value
  if (!section) return

  const range = wysiwygPlainRange()
  if (range) {
    section.content = bumpFontSizeInPlainRange(
      section.content,
      range.start,
      range.end,
      delta,
      section.fontSize,
    )
    chromeDraftFontSize.value = Math.max(1, section.fontSize + delta)
    emit('change', { transient: true })
    void nextTick(() => syncCeFromModel())
    return
  }

  const el = getEditEl()
  if (!el) return

  const marked = el.querySelector('[data-op-chrome-sel]')
  if (marked instanceof HTMLElement) {
    const current = Number.parseFloat(marked.style.fontSize || '')
    const base = Number.isFinite(current) ? current : section.fontSize
    const next = Math.max(1, base + delta)
    applyInlineStyleToElement(marked, { fontSize: next })
    chromeDraftFontSize.value = next
    rememberStyledSelection(marked)
    syncEditContent()
    return
  }

  restoreEditSelection()
  let bumped = false
  if (getEditableSelectionRange(el) && bumpFontSizesInSelection(el, delta)) {
    bumped = true
  } else {
    const saved = savedEditRange.value
    if (saved && el.contains(saved.commonAncestorContainer)) {
      try {
        const sel = el.ownerDocument.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(saved)
        bumped = bumpFontSizesInSelection(el, delta)
      } catch {
        bumped = false
      }
    }
  }
  if (bumped) {
    const live = getEditableSelectionRange(el)
    if (live) {
      const wrapper =
        live.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
          ? (live.commonAncestorContainer as HTMLElement)
          : live.commonAncestorContainer.parentElement
      if (wrapper && el.contains(wrapper)) rememberStyledSelection(wrapper)
      else savedEditRange.value = live.cloneRange()
    }
    syncEditContent()
    return
  }
  bumpTextSectionFonts(section, delta)
  chromeDraftFontSize.value = null
  const content = sanitizeTextHtml(section.content)
  section.content = content
  syncCeFromModel()
  emit('change')
}

function sectionClass(section: Section) {
  const selected = selectedIds.value.includes(section.id)
  const snapTarget = snapTargetIds.value.has(section.id)
  return {
    [`op-section--${section.type}`]: true,
    'is-selected': selected,
    'is-hovered': props.hoveredSectionId === section.id && !selected,
    'is-snap-target': snapTarget,
    'is-hidden': section.hidden,
  }
}

function alignGuideStyle(guide: Extract<SnapGuide, { kind: 'align' }>) {
  if (guide.orientation === 'vertical') {
    return { left: `${guide.position}px` }
  }
  return { top: `${guide.position}px` }
}

function gapSegmentStyle(guide: SnapGuide, segment: { start: number; end: number; cross: number }) {
  if (guide.kind !== 'gap') return {}
  if (guide.orientation === 'horizontal') {
    return {
      left: `${segment.start}px`,
      width: `${Math.max(0, segment.end - segment.start)}px`,
      top: `${segment.cross}px`,
    }
  }
  return {
    top: `${segment.start}px`,
    height: `${Math.max(0, segment.end - segment.start)}px`,
    left: `${segment.cross}px`,
  }
}

function emitSelect(sectionId: string, event: MouseEvent | PointerEvent) {
  emit('select', sectionId, { additive: event.ctrlKey || event.metaKey })
}

function onPageClick() {
  endTextEdit()
  emit('clearSelection')
}

function onSectionClickStop() {
  // Prevent page clear; selection is handled on pointerdown only (avoids ctrl double-toggle).
}

function isNudgeKey(key: string): key is NudgeKey {
  return key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight'
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    if (cancelDrag()) {
      event.preventDefault()
    }
    return
  }
  if (selectedIds.value.length === 0 || !isNudgeKey(event.key)) {
    return
  }
  // Nudge requires Ctrl/Cmd so plain arrows keep caret/browser behavior.
  if (!(event.ctrlKey || event.metaKey)) {
    return
  }
  event.preventDefault()
  const step = event.shiftKey ? 10 : 1
  let changed = false
  for (const id of selectedIds.value) {
    if (nudgeSection(page.value, id, event.key, step)) {
      changed = true
    }
  }
  if (changed) {
    emit('change')
  }
}

function cancelDrag(): boolean {
  const state = drag.value
  if (!state) return false
  if (state.mode === 'move') {
    moveSection(page.value, state.sectionId, state.originX, state.originY)
  } else {
    resizeSection(page.value, state.sectionId, state.originW, state.originH)
  }
  drag.value = null
  snapGuides.value = []
  window.removeEventListener('keydown', onWindowKeydown)
  emit('change', { transient: true })
  return true
}

function onWindowKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && drag.value) {
    event.preventDefault()
    cancelDrag()
  }
}

function beginDrag(mode: DragMode, section: Section, event: PointerEvent) {
  if (event.button !== 0) {
    return
  }
  if (editingSectionId.value === section.id) {
    return
  }
  emitSelect(section.id, event)
  if (section.locked) {
    return
  }
  event.preventDefault()
  snapGuides.value = []
  drag.value = {
    mode,
    sectionId: section.id,
    startX: event.clientX,
    startY: event.clientY,
    originX: section.x,
    originY: section.y,
    originW: section.width,
    originH: section.height,
    moved: false,
  }
  window.addEventListener('keydown', onWindowKeydown)
}

function onPointerMove(event: PointerEvent) {
  const state = drag.value
  if (!state) {
    return
  }
  const dx = event.clientX - state.startX
  const dy = event.clientY - state.startY
  if (dx !== 0 || dy !== 0) {
    state.moved = true
  }
  if (state.mode === 'move') {
    const section = page.value.sections.find((entry) => entry.id === state.sectionId)
    if (!section) return
    const proposedX = state.originX + dx
    const proposedY = state.originY + dy
    const others = page.value.sections
      .filter((entry) => entry.id !== state.sectionId && !entry.hidden)
      .map((entry) => ({
        id: entry.id,
        x: entry.x,
        y: entry.y,
        width: entry.width,
        height: entry.height,
      }))
    const snapped = snapSectionPosition(
      { x: section.x, y: section.y, width: section.width, height: section.height },
      { x: proposedX, y: proposedY },
      others,
      {
        width: page.value.width,
        height: page.value.height,
        margins: page.value.margins,
      },
      { enabled: props.snapEnabled, shiftKey: event.shiftKey },
    )
    moveSection(page.value, state.sectionId, snapped.x, snapped.y)
    snapGuides.value = snapped.guides
  } else {
    resizeSection(page.value, state.sectionId, state.originW + dx, state.originH + dy)
    snapGuides.value = []
  }
  emit('change', { transient: true })
}

function endDrag() {
  if (!drag.value) return
  drag.value = null
  snapGuides.value = []
  window.removeEventListener('keydown', onWindowKeydown)
  emit('change')
}

function showResize(section: Section): boolean {
  return selectedIds.value.length === 1 && selectedIds.value[0] === section.id && !section.locked
}

const data = computed(() => props.document.data ?? {})

function layoutLines(section: Section): { lines: LaidOutLine[]; fontSize: number } {
  if (section.type !== 'text' && section.type !== 'headline') {
    return { lines: [], fontSize: 16 }
  }
  const exclusions = relativeExclusionsForHost(
    { x: section.x, y: section.y, width: section.width, height: section.height },
    page.value.sections
      .filter((s): s is Extract<Section, { type: 'runaround' }> => s.type === 'runaround')
      .map((s) => ({
        id: s.id,
        x: s.x,
        y: s.y,
        width: s.width,
        height: s.height,
        wrapOffset: s.wrapOffset,
        hidden: s.hidden,
      })),
  ).map((ex) => ({ x: ex.x, y: ex.y, width: ex.width, height: ex.height }))

  const html = textOf(section)
  const runs = inlineRunsFromHtml(html)
  const fitted = fitTextFrame({
    text: htmlToPlainText(html),
    host: { x: 0, y: 0, width: section.width, height: section.height },
    columnCount: section.columnCount,
    columnGap: COLUMN_GAP_PX,
    fontSize: section.fontSize,
    lineHeight: section.lineHeight,
    fontFamily: section.fontFamily,
    fontBold: section.fontBold,
    fontItalic: section.fontItalic,
    exclusions,
    measure: textMeasurer,
    mode: section.textFit,
    inlineRuns: runs,
  })
  return { lines: fitted.lines, fontSize: fitted.fontSize }
}

const lineLayouts = computed(() => {
  const map = new Map<string, { lines: LaidOutLine[]; fontSize: number }>()
  for (const section of visibleSections.value) {
    if (section.type === 'text' || section.type === 'headline') {
      map.set(section.id, layoutLines(section))
    }
  }
  return map
})

function lineBoxStyle(section: Section, line: LaidOutLine, fontSize: number) {
  const scale = line.fontScale ?? 1
  const bold =
    line.fontBold ??
    (section.type === 'text' || section.type === 'headline' ? section.fontBold : false)
  const italic =
    line.fontItalic ??
    (section.type === 'text' || section.type === 'headline' ? section.fontItalic : false)
  const decorations: string[] = []
  if (section.type === 'text' || section.type === 'headline') {
    if (section.fontUnderline) decorations.push('underline')
    if (section.fontStrike) decorations.push('line-through')
  }
  return {
    left: `${line.x}px`,
    top: `${line.y}px`,
    width: `${line.width}px`,
    height: `${line.height}px`,
    fontSize: `${fontSize * scale}px`,
    lineHeight: `${line.height}px`,
    fontFamily:
      section.type === 'text' || section.type === 'headline' ? section.fontFamily : undefined,
    fontWeight: bold ? '700' : '400',
    fontStyle: italic ? 'italic' : 'normal',
    textDecoration: decorations.length ? decorations.join(' ') : 'none',
    paddingLeft: line.listMarker ? '1.35em' : undefined,
  }
}

function runBoxStyle(run: {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  color?: string
  fontFamily?: string
  fontSize?: number
  lineHeight?: number
}) {
  const decorations: string[] = []
  if (run.underline) decorations.push('underline')
  if (run.strike) decorations.push('line-through')
  return {
    fontWeight: run.bold ? '700' : undefined,
    fontStyle: run.italic ? 'italic' : undefined,
    textDecoration: decorations.length ? decorations.join(' ') : undefined,
    color: run.color,
    fontFamily: run.fontFamily,
    fontSize: run.fontSize != null ? `${run.fontSize}px` : undefined,
    lineHeight: run.lineHeight != null ? String(run.lineHeight) : undefined,
  }
}

function textOf(section: Section): string {
  if (section.type !== 'text' && section.type !== 'headline') return ''
  return sanitizeTextHtml(resolveTemplate(section.content, data.value))
}

function imageSrc(section: Section): string {
  if (section.type !== 'image') return ''
  return resolveTemplate(section.src, data.value)
}

function imageAlt(section: Section): string {
  if (section.type !== 'image') return ''
  return resolveTemplate(section.alt, data.value)
}
</script>

<template>
  <div
    class="op-renderer"
    data-op-renderer
    tabindex="0"
    @keydown="onKeydown"
    @pointermove="onPointerMove"
    @pointerup="endDrag"
    @pointerleave="endDrag"
  >
    <div class="op-page" data-op-page :style="pageStyle" @click="onPageClick">
      <div class="op-margin-guide" data-op-margin-guide :style="marginStyle" />
      <div
        v-for="guide in page.guides"
        :key="guide.id"
        class="op-guide"
        data-op-guide
        :data-orientation="guide.orientation"
        :style="guideStyle(guide)"
      />
      <div
        v-for="section in visibleSections"
        :key="section.id"
        class="op-section"
        :class="sectionClass(section)"
        :data-op-section="section.id"
        :data-op-section-type="section.type"
        :data-op-snap-target="snapTargetIds.has(section.id) ? '' : undefined"
        :data-border-style="section.type === 'panel' ? section.borderStyle : undefined"
        :style="sectionStyle(section)"
        @click.stop="onSectionClickStop"
        @pointerdown.stop="beginDrag('move', section, $event)"
        @dblclick.stop="beginTextEdit(section)"
      >
        <template v-if="section.type === 'text' || section.type === 'headline'">
          <textarea
            v-if="isEditing(section) && textEditMode === 'source'"
            class="op-section-text-source"
            data-op-text-source
            @pointerdown.stop
            @input="onSourceInput"
          />
          <template v-else>
            <div
              class="op-section-lines"
              :class="{ 'is-editing': isEditing(section) && textEditMode === 'wysiwyg' }"
              data-op-lines
            >
              <div
                v-for="(line, lineIndex) in lineLayouts.get(section.id)?.lines ?? []"
                :key="`${section.id}-${lineIndex}`"
                class="op-line"
                data-op-line
                :data-op-marker="line.listMarker || undefined"
                :style="
                  lineBoxStyle(
                    section,
                    line,
                    lineLayouts.get(section.id)?.fontSize ?? section.fontSize,
                  )
                "
              >
                <template v-if="line.runs && line.runs.length">
                  <span
                    v-for="(run, runIndex) in line.runs"
                    :key="runIndex"
                    data-op-run
                    :data-op-bold="run.bold ? '' : undefined"
                    :data-op-italic="run.italic ? '' : undefined"
                    :data-op-underline="run.underline ? '' : undefined"
                    :data-op-strike="run.strike ? '' : undefined"
                    :data-op-color="run.color ? '' : undefined"
                    :style="runBoxStyle(run)"
                    >{{ run.text }}</span
                  >
                </template>
                <template v-else>{{ line.text }}</template>
              </div>
              <div
                v-for="(sel, selIndex) in isEditing(section) && textEditMode === 'wysiwyg'
                  ? wysiwygSelectionRects(section)
                  : []"
                :key="`${section.id}-sel-${selIndex}`"
                class="op-text-sel"
                data-op-text-sel
                :style="{
                  left: `${sel.x}px`,
                  top: `${sel.y}px`,
                  width: `${sel.width}px`,
                  height: `${sel.height}px`,
                }"
              />
              <div
                v-if="isEditing(section) && textEditMode === 'wysiwyg'"
                class="op-text-caret"
                data-op-text-caret
                :style="wysiwygCaretStyle(section)"
              />
            </div>
            <div
              v-if="isEditing(section) && textEditMode === 'wysiwyg'"
              class="op-section-text-edit"
              data-op-text-edit
              contenteditable="true"
              spellcheck="false"
              role="textbox"
              aria-multiline="true"
              :aria-label="i18n.t('chrome.editText')"
              @pointerdown.stop="onWysiwygPointerDown(section, $event)"
              @pointermove="onWysiwygPointerMove(section, $event)"
              @pointerup="onWysiwygPointerUp($event)"
              @pointercancel="onWysiwygPointerUp($event)"
              @keydown="onWysiwygKeydown"
              @copy="onWysiwygCopy"
              @cut="onWysiwygCut"
              @paste="onWysiwygPaste"
              @input="onTextEditInput"
              @compositionstart="onCompositionStart"
              @compositionend="onCompositionEnd"
            />
          </template>
        </template>
        <img
          v-else-if="section.type === 'image'"
          class="op-section-image"
          :src="imageSrc(section)"
          :alt="imageAlt(section)"
          :style="{ objectFit: section.fit }"
        />
        <div
          v-else-if="section.type === 'panel'"
          class="op-section-panel"
          :data-border-style="section.borderStyle"
        />
        <div v-else-if="section.type === 'runaround'" class="op-section-runaround" />
        <button
          v-if="showResize(section) && !isEditing(section)"
          type="button"
          class="op-resize-handle"
          :data-op-resize="section.id"
          :aria-label="i18n.t('chrome.resizeSection')"
          @pointerdown.stop="beginDrag('resize', section, $event)"
        />
      </div>
      <div
        v-if="showSelectionChrome"
        class="op-selection-chrome"
        data-op-selection-chrome
        :style="selectionChromeStyle()"
        @pointerdown.stop
        @click.stop
      >
        <slot name="selection-chrome" />
      </div>
      <div
        v-if="textChromeSection"
        class="op-text-chrome"
        data-op-text-chrome
        :style="textChromeStyle()"
        @mousedown.capture="onChromeMouseDown"
        @pointerdown.stop
        @click.stop
      >
        <select
          :value="chromeSelectedFontId()"
          :aria-label="i18n.t('chrome.fontFamily')"
          @change="onChromeFamily(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="font in fonts" :key="font.id" :value="font.id">
            {{ font.label }}
          </option>
        </select>
        <input
          data-op-text-chrome-size
          type="number"
          min="1"
          step="0.1"
          :value="chromeDraftFontSize ?? textChromeSection.fontSize"
          :aria-label="i18n.t('chrome.fontSize')"
          @input="onChromeFontSize(($event.target as HTMLInputElement).value)"
          @change="onChromeFontSize(($event.target as HTMLInputElement).value)"
        />
        <button
          type="button"
          class="op-chrome-btn"
          data-op-chrome-font-down
          :title="i18n.t('chrome.smaller')"
          @click="onChromeFontBump(-2)"
        >
          <AArrowDown class="op-chrome-icon" :size="14" :stroke-width="2" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="op-chrome-btn"
          data-op-chrome-font-up
          :title="i18n.t('chrome.larger')"
          @click="onChromeFontBump(2)"
        >
          <AArrowUp class="op-chrome-icon" :size="14" :stroke-width="2" aria-hidden="true" />
        </button>
        <input
          data-op-text-chrome-lineheight
          type="number"
          min="0.5"
          step="0.05"
          :value="chromeDraftLineHeight ?? textChromeSection.lineHeight"
          :aria-label="i18n.t('chrome.lineHeight')"
          :title="i18n.t('chrome.lineHeight')"
          @input="onChromeLineHeight(($event.target as HTMLInputElement).value)"
          @change="onChromeLineHeight(($event.target as HTMLInputElement).value)"
        />
        <input
          data-op-text-chrome-color
          type="color"
          :value="textChromeSection.color"
          :aria-label="i18n.t('chrome.textColor')"
          @input="onChromeColor(($event.target as HTMLInputElement).value)"
        />
        <button
          type="button"
          class="op-chrome-btn"
          data-op-chrome-bold
          :title="i18n.t('chrome.bold')"
          @click="onChromeCommand('bold')"
        >
          <Bold class="op-chrome-icon" :size="14" :stroke-width="2" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="op-chrome-btn"
          data-op-chrome-italic
          :title="i18n.t('chrome.italic')"
          @click="onChromeCommand('italic')"
        >
          <Italic class="op-chrome-icon" :size="14" :stroke-width="2" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="op-chrome-btn"
          data-op-chrome-underline
          :title="i18n.t('chrome.underline')"
          @click="onChromeCommand('underline')"
        >
          <Underline class="op-chrome-icon" :size="14" :stroke-width="2" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="op-chrome-btn"
          data-op-chrome-strike
          :title="i18n.t('chrome.strike')"
          @click="onChromeCommand('strikeThrough')"
        >
          <Strikethrough class="op-chrome-icon" :size="14" :stroke-width="2" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="op-chrome-btn"
          data-op-chrome-source-toggle
          :title="
            textEditMode === 'source' ? i18n.t('chrome.visualEditor') : i18n.t('chrome.htmlSource')
          "
          :aria-pressed="textEditMode === 'source'"
          @click="toggleTextEditMode"
        >
          <TextInitial v-if="textEditMode === 'source'" class="op-chrome-icon" :size="14" :stroke-width="2" aria-hidden="true" />
          <CodeXml v-else class="op-chrome-icon" :size="14" :stroke-width="2" aria-hidden="true" />
        </button>
        <span class="op-chrome-grow" aria-hidden="true" />
        <button
          type="button"
          class="op-chrome-btn op-chrome-delete"
          data-op-chrome-delete
          :title="i18n.t('chrome.deleteBlock')"
          :aria-label="i18n.t('chrome.deleteBlock')"
          @click="onChromeDeleteSection"
        >
          <Trash2 class="op-chrome-icon" :size="14" :stroke-width="2" aria-hidden="true" />
        </button>
      </div>
      <div
        v-for="(guide, index) in snapGuides"
        :key="`snap-${guide.kind}-${index}`"
        class="op-snap-guide"
        data-op-snap-guide
        :data-snap-kind="guide.kind"
        :data-orientation="guide.orientation"
      >
        <div
          v-if="guide.kind === 'align'"
          class="op-snap-align"
          :data-orientation="guide.orientation"
          :style="alignGuideStyle(guide)"
        />
        <div
          v-for="(segment, segIndex) in guide.kind === 'gap' ? guide.segments : []"
          :key="`gap-${segIndex}`"
          class="op-snap-gap"
          :data-orientation="guide.orientation"
          :style="gapSegmentStyle(guide, segment)"
        />
      </div>
    </div>
  </div>
</template>
