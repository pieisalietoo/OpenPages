<script setup lang="ts">
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Trash2,
} from '@lucide/vue'
import {
  computed,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  reactive,
  ref,
  watch,
} from 'vue'
import {
  createBrowserExportAdapters,
  createExporter,
  type ExportAdapters,
  type ExportFormat,
} from '../export/exporters'
import { createI18n, type LocaleCode, type OpenPagesI18n } from '../i18n'
import { OPEN_PAGES_I18N } from '../i18n/keys'
import { insertImageFromSrc, readImageFileAsDataUrl } from '../model/assets'
import { nudgeImageContent } from '../model/viewport-content'
import {
  type OpenPagesDocument,
  parseDocument,
  serializeDocument,
  serializeLayoutSource,
} from '../model/document'
import {
  applyCatalogFontSelection,
  BUILTIN_FONTS,
  createFontCatalog,
  type FontCatalog,
  loadOpenPagesFonts,
  matchCatalogFont,
  missingFontFamilies,
  type OpenPagesFont,
  slugFontId,
} from '../model/fonts'
import { createHistory } from '../model/history'
import { createLayoutLibrary, type LayoutLibrary, type NamedLayout } from '../model/layouts'
import { applyPagePreset, setPageMargins } from '../model/page'
import { addBlankPage, deletePage, duplicatePage, movePage } from '../model/pages'
import { canSelectWhileFocused, canvasTransformForPanelFocus } from '../model/panel-focus'
import {
  type AddSectionOptions,
  addSectionToPage,
  bringForward,
  bringToFront,
  bumpTextSectionFonts,
  deleteSection,
  duplicateSection,
  groupSections,
  type SectionType,
  sendBackward,
  sendToBack,
  setSectionHidden,
  setSectionLocked,
  setSectionRunaround,
  setSectionRunaroundMargins,
  type TextAlign,
  ungroupSections,
  updateSectionStyle,
  updateTextStyle,
  type VerticalAlign,
} from '../model/section'
import {
  clearSelection,
  createSelection,
  selectSection,
  toggleSectionSelection,
} from '../model/selection'
import { POPOVER_MIN_WIDTH_PX, shouldAlignPopoverEnd } from '../tooling/popover-align'
import { visibleSelectionTools } from '../tooling/selection-tools'
import {
  DEFAULT_DOCUMENT_TOOLBAR,
  DEFAULT_SELECTION_TOOLBAR,
  mergeDocumentToolbarOrder,
  resolveToolbarEntries,
  type ToolbarItemId,
} from '../tooling/toolbar-order'
import {
  createToolController,
  type ExtraDocumentTool,
  type ToolActivateEvent,
  type ToolId,
} from '../tooling/tools'
import OpenPagesRenderer from './OpenPagesRenderer.vue'
import OpenPagesToolbar, { type ToolbarIconMap } from './OpenPagesToolbar.vue'
import OpShadowRoot from './OpShadowRoot.vue'

/** Half-height A above a left↔right stretch arrow. */
const AlignStretchIcon = defineComponent({
  name: 'AlignStretchIcon',
  setup() {
    return () =>
      h(
        'svg',
        {
          xmlns: 'http://www.w3.org/2000/svg',
          width: '24',
          height: '24',
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': '2',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          class: 'lucide op-align-icon',
          'aria-hidden': 'true',
        },
        [
          // Compact A in the upper half
          h('path', { d: 'M9 11 L12 3 L15 11' }),
          h('path', { d: 'M10.2 8h3.6' }),
          // Bidirectional stretch arrow with clearance under the A
          h('path', { d: 'M4 18h16' }),
          h('path', { d: 'M7 15 L4 18 L7 21' }),
          h('path', { d: 'M17 15 L20 18 L17 21' }),
        ],
      )
  },
})

const H_ALIGN_ICONS = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
  justify: AlignJustify,
  stretch: AlignStretchIcon,
} as const

const V_ALIGN_ICONS = {
  top: AlignVerticalJustifyStart,
  middle: AlignVerticalJustifyCenter,
  bottom: AlignVerticalJustifyEnd,
} as const

const props = withDefaults(
  defineProps<{
    modelValue: OpenPagesDocument
    json?: string
    toolEnabled?: Partial<Record<ToolId, boolean>>
    layoutLibrary?: LayoutLibrary
    layouts?: NamedLayout[]
    exportAdapters?: ExportAdapters
    fonts?: OpenPagesFont[]
    fontCatalog?: FontCatalog
    /** Shared i18n controller (optional). */
    i18n?: OpenPagesI18n
    /** Initial locale when `i18n` is not passed (default `en`). */
    locale?: LocaleCode
    /** Host veto before persisting a named layout; return false to abort. */
    beforeLayoutSave?: (payload: {
      name: string
      document: OpenPagesDocument
      /** true when saving over an existing named layout. */
      exists: boolean
    }) => boolean | Promise<boolean>
    /** Host veto before adding/replacing a catalog font; return false to abort. */
    beforeFontAdd?: (payload: {
      font: OpenPagesFont
      /** true when adding over an existing unlocked font id. */
      exists: boolean
    }) => boolean | Promise<boolean>
    /** Ordered document toolbar ids (`sep` / `grow` allowed). Omitted ids stay hidden. */
    documentToolbar?: ToolbarItemId[]
    /** Ordered selection toolbar ids (`sep` / `grow` allowed). Omitted ids stay hidden. */
    selectionToolbar?: ToolbarItemId[]
    /**
     * Extra document-toolbar tools from the host (id, label, icon, optional action).
     * With the default order they are inserted before the last `grow`; with a custom
     * `documentToolbar` they appear only if their ids are listed in that order.
     */
    extraDocumentTools?: ExtraDocumentTool[]
    /**
     * Extra / override toolbar icons keyed by the same strings used in `icon` fields
     * (built-ins + host keys). Merged into the toolbar icon map; host keys win.
     */
    toolbarIcons?: ToolbarIconMap
    /**
     * Extra CSS injected into the editor Shadow DOM after package chrome
     * (string or list of stylesheet texts).
     */
    shadowStyles?: string | string[]
  }>(),
  {
    toolEnabled: () => ({}),
    layouts: () => [],
    fonts: () => BUILTIN_FONTS,
    locale: 'en',
    extraDocumentTools: () => [],
    toolbarIcons: () => ({}),
    shadowStyles: () => [],
  },
)

const emit = defineEmits<{
  'update:modelValue': [OpenPagesDocument]
  'update:json': [string]
  toolActivate: [ToolActivateEvent]
  toolChange: [{ id: ToolId; enabled: boolean }]
  layoutChange: [{ name: string | null }]
  fontsChange: [{ fonts: OpenPagesFont[] }]
  fontsMissing: [string[]]
  export: [{ format: ExportFormat | 'json'; result: unknown }]
  selectionChange: [string[]]
  'panel-focus-enter': [{ panelId: string }]
  'panel-focus-exit': [{ panelId: string }]
}>()

const i18n = props.i18n ?? createI18n({ locale: props.locale })
provide(OPEN_PAGES_I18N, i18n)

function toolLabel(id: ToolId, fallback: string): string {
  i18n.locale.value
  const key = `tools.${String(id)}`
  const translated = i18n.t(key)
  return translated === key ? fallback : translated
}

const tools = createToolController({ initialEnabled: props.toolEnabled })
const toolEpoch = ref(0)
const selection = reactive(createSelection())
const openPopoverId = ref<ToolId | null>(null)
const saveName = ref('')
const saveError = ref<string | null>(null)
const importName = ref('')
const importError = ref<string | null>(null)
const importFileInput = ref<HTMLInputElement | null>(null)
const importFile = ref<File | null>(null)
const pendingImportDoc = ref<OpenPagesDocument | null>(null)
const pageEl = ref<HTMLElement | null>(null)
const layoutEpoch = ref(0)
const fontEpoch = ref(0)
const missingFontsWarning = ref<string[] | null>(null)
const fontFormLabel = ref('')
const fontFormSource = ref('')
const fontFormWeight = ref('')
const fontFormStyle = ref<'normal' | 'italic'>('normal')
const pendingDelete = ref<
  { kind: 'layout'; name: string } | { kind: 'font'; id: string; label: string } | null
>(null)
const pendingOverwrite = ref<string | null>(null)
const applyingJson = ref(false)
const magnetEnabled = ref(true)
const history = createHistory({ limit: 100 })
const applyingHistory = ref(false)

onMounted(() => {
  history.push(serializeDocument(props.modelValue))
  window.addEventListener('keydown', onEditorKeydown)
  window.addEventListener('pointerdown', onDismissOpenMenus, true)
  window.addEventListener('focusin', onDismissOpenMenus, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onEditorKeydown)
  window.removeEventListener('pointerdown', onDismissOpenMenus, true)
  window.removeEventListener('focusin', onDismissOpenMenus, true)
})

function menuDismissPathKeepsOpen(event: Event): boolean {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : []
  return path.some(
    (node) =>
      node instanceof Element &&
      node.matches(
        '[data-op-popover], [data-op-tool], [data-op-page-add-menu], [data-op-page-add]',
      ),
  )
}

function onDismissOpenMenus(event: Event) {
  if (!openPopoverId.value && !addMenuOpen.value) return
  if (menuDismissPathKeepsOpen(event)) return
  openPopoverId.value = null
  addMenuOpen.value = false
}

function onEditorKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && (openPopoverId.value || addMenuOpen.value)) {
    event.preventDefault()
    openPopoverId.value = null
    addMenuOpen.value = false
    return
  }
  const target = event.target as HTMLElement | null
  if (target?.closest?.('[contenteditable="true"], input, textarea, select')) {
    return
  }
  if (event.key === 'Delete' && selection.selectedSectionIds.length > 0) {
    event.preventDefault()
    activateTool('section.delete')
    return
  }
  // A5: Alt+arrows pan / Alt++- zoom image content inside clipped frame
  if (event.altKey && selection.selectedSectionIds.length === 1) {
    const page = props.modelValue.pages[pageIndex.value]
    const sectionId = selection.selectedSectionIds[0]
    const section = page?.sections.find((s) => s.id === sectionId)
    if (page && section?.type === 'image') {
      const step = event.shiftKey ? 20 : 4
      let handled = false
      if (event.key === 'ArrowLeft') {
        handled = nudgeImageContent(page, sectionId, -step, 0)
      } else if (event.key === 'ArrowRight') {
        handled = nudgeImageContent(page, sectionId, step, 0)
      } else if (event.key === 'ArrowUp') {
        handled = nudgeImageContent(page, sectionId, 0, -step)
      } else if (event.key === 'ArrowDown') {
        handled = nudgeImageContent(page, sectionId, 0, step)
      } else if (event.key === '=' || event.key === '+') {
        handled = nudgeImageContent(page, sectionId, 0, 0, 0.1)
      } else if (event.key === '-' || event.key === '_') {
        handled = nudgeImageContent(page, sectionId, 0, 0, -0.1)
      }
      if (handled) {
        event.preventDefault()
        bumpDocument()
        return
      }
    }
  }
  const mod = event.ctrlKey || event.metaKey
  if (!mod) return
  const key = event.key.toLowerCase()
  if (key === 'z' && !event.shiftKey) {
    event.preventDefault()
    applyHistorySnapshot(history.undo())
    return
  }
  if (key === 'y' || (key === 'z' && event.shiftKey)) {
    event.preventDefault()
    applyHistorySnapshot(history.redo())
  }
}

function applyHistorySnapshot(snapshot: string | null) {
  if (!snapshot) return
  try {
    const parsed = parseDocument(snapshot)
    applyingHistory.value = true
    emit('update:modelValue', parsed)
    emit('update:json', snapshot)
    clearSelection(selection)
    emitSelection()
  } catch {
    // ignore invalid snapshot
  } finally {
    applyingHistory.value = false
  }
}

function bumpDocument(payload?: { transient?: boolean }) {
  emit('update:modelValue', props.modelValue)
  emit('update:json', serializeDocument(props.modelValue))
  if (!payload?.transient && !applyingHistory.value) {
    history.push(serializeDocument(props.modelValue))
  }
}

async function onCanvasImageDrop(event: DragEvent) {
  event.preventDefault()
  const file = [...(event.dataTransfer?.files ?? [])].find((f) => f.type.startsWith('image/'))
  if (!file) return
  const page = currentPage.value
  const src = await readImageFileAsDataUrl(file)
  const pageNode = pageEl.value?.querySelector('[data-op-page]') as HTMLElement | null
  const rect = pageNode?.getBoundingClientRect()
  const x = rect ? Math.max(0, event.clientX - rect.left) : page.margins.left
  const y = rect ? Math.max(0, event.clientY - rect.top) : page.margins.top
  insertImageFromSrc(props.modelValue, page, {
    src,
    alt: file.name,
    x,
    y,
    width: 200,
    height: 160,
  })
  bumpDocument()
}

const layouts =
  props.layoutLibrary ??
  createLayoutLibrary({
    layouts: props.layouts.length
      ? props.layouts
      : [{ name: 'Current', document: props.modelValue }],
    activeName: props.layouts[0]?.name ?? 'Current',
  })

const catalog: FontCatalog =
  props.fontCatalog ??
  createFontCatalog({
    fonts: props.fonts,
    includeBuiltins: false,
  })

catalog.on('fontsChange', (event) => {
  fontEpoch.value += 1
  emit('fontsChange', event)
})

const fonts = computed(() => {
  fontEpoch.value
  return catalog.list()
})

const exporter = createExporter({
  ...createBrowserExportAdapters({
    fonts: () => catalog.list(),
  }),
  ...props.exportAdapters,
})

watch(
  () => props.toolEnabled,
  (value) => {
    for (const tool of tools.listAll()) {
      const override = value?.[tool.id]
      // Missing key means enabled (host map is a sparse disable list).
      tools.setEnabled(tool.id, override === undefined ? true : override)
    }
    toolEpoch.value += 1
  },
  { deep: true, immediate: true },
)

watch(
  () => props.json,
  (value) => {
    if (value === undefined || applyingJson.value) return
    const current = serializeDocument(props.modelValue)
    if (value === current) return
    try {
      const parsed = parseDocument(value)
      applyingJson.value = true
      emit('update:modelValue', parsed)
      clearSelection(selection)
      emit('selectionChange', [])
    } catch {
      // invalid json from host â€” ignore until valid
    } finally {
      applyingJson.value = false
    }
  },
)

tools.on('toolChange', (event) => {
  toolEpoch.value += 1
  emit('toolChange', event)
})
tools.on('toolActivate', (event) => emit('toolActivate', event))
layouts.on('layoutChange', (event) => {
  layoutEpoch.value += 1
  activeLayoutName.value = event.activeName
  emit('layoutChange', { name: event.activeName })
})
exporter.on('export', (event) => emit('export', event))

const activeLayoutName = ref<string | null>(layouts.getActive()?.name ?? null)
const layoutBaselineJson = ref(
  (() => {
    const active = layouts.getActive()
    return active ? serializeDocument(active.document) : serializeDocument(props.modelValue)
  })(),
)

const layoutDirty = computed(() => serializeDocument(props.modelValue) !== layoutBaselineJson.value)

const layoutEntries = computed(() => {
  layoutEpoch.value
  const active = activeLayoutName.value
  const dirty = layoutDirty.value
  return layouts.list().map((layout) => ({
    name: layout.name,
    locked: layout.locked === true,
    active: layout.name === active,
    label: layout.name === active && dirty ? `${layout.name} *` : layout.name,
  }))
})

function setLayoutBaselineFromActive() {
  const active = layouts.getActive()
  activeLayoutName.value = active?.name ?? null
  layoutBaselineJson.value = active
    ? serializeDocument(active.document)
    : serializeDocument(props.modelValue)
}

const documentToolbarEntries = computed(() => {
  toolEpoch.value
  i18n.locale.value
  const extras = props.extraDocumentTools ?? []
  const customOrder = props.documentToolbar != null
  const order = mergeDocumentToolbarOrder(
    props.documentToolbar ?? DEFAULT_DOCUMENT_TOOLBAR,
    extras.map((tool) => tool.id),
    { autoInsert: !customOrder },
  )
  const available = [
    ...tools.list('document').map((tool) => ({
      ...tool,
      label: toolLabel(tool.id, tool.label),
    })),
    ...extras.map((tool) => ({
      id: tool.id,
      scope: 'document' as const,
      label: tool.label,
      icon: tool.icon,
      enabled: true,
    })),
  ]
  return resolveToolbarEntries(order, available)
})

const selectedSections = computed(() =>
  selection.selectedSectionIds
    .map((id) => currentPage.value.sections.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s)),
)

const selectionToolbarEntries = computed(() => {
  toolEpoch.value
  i18n.locale.value
  const order = props.selectionToolbar ?? DEFAULT_SELECTION_TOOLBAR
  const base = visibleSelectionTools(tools.list('selection'), selectedSections.value)
  const allLocked =
    selectedSections.value.length > 0 && selectedSections.value.every((s) => s.locked)
  const allHidden =
    selectedSections.value.length > 0 && selectedSections.value.every((s) => s.hidden)
  const available = base.map((tool) => {
    if (tool.id === 'section.lock' && allLocked) {
      return { ...tool, icon: 'lock-open', label: i18n.t('tools.section.unlock') }
    }
    if (tool.id === 'section.hide' && allHidden) {
      return { ...tool, icon: 'eye', label: i18n.t('tools.section.show') }
    }
    return { ...tool, label: toolLabel(tool.id, tool.label) }
  })
  return resolveToolbarEntries(order, available)
})

const activeToolIds = computed(() => {
  const ids: ToolId[] = []
  if (magnetEnabled.value) ids.push('view.magnet')
  if (selectedSections.value.length > 0 && selectedSections.value.every((s) => s.locked)) {
    ids.push('section.lock')
  }
  if (selectedSections.value.length > 0 && selectedSections.value.every((s) => s.hidden)) {
    ids.push('section.hide')
  }
  if (
    selectedSections.value.length > 0 &&
    selectedSections.value.every((s) => s.type !== 'runaround' && s.runaround)
  ) {
    ids.push('section.runaround')
  }
  return ids
})

const pageIndex = ref(0)
const editingPageNumber = ref(false)
const pageNumberDraft = ref('')
const pageJumpInput = ref<HTMLInputElement | null>(null)
const addMenuOpen = ref(false)
const addMenuAlignEnd = ref(false)
const pageAddEl = ref<HTMLElement | null>(null)
const pageNavEl = ref<HTMLElement | null>(null)

watch(addMenuOpen, async (open) => {
  addMenuAlignEnd.value = false
  if (!open) return
  await nextTick()
  const anchor = pageAddEl.value?.getBoundingClientRect()
  const container = pageNavEl.value?.getBoundingClientRect()
  if (!anchor || !container) return
  addMenuAlignEnd.value = shouldAlignPopoverEnd({
    anchorLeft: anchor.left,
    containerRight: container.right,
    minWidth: POPOVER_MIN_WIDTH_PX,
  })
})

const pageCount = computed(() => props.modelValue.pages.length)

watch(
  () => props.modelValue.pages.length,
  (length) => {
    if (pageIndex.value >= length) {
      pageIndex.value = Math.max(0, length - 1)
    }
  },
)

watch(editingPageNumber, (editing) => {
  if (!editing) return
  void nextTick(() => {
    pageJumpInput.value?.focus()
    pageJumpInput.value?.select()
  })
})

const currentPage = computed(() => {
  const page = props.modelValue.pages[pageIndex.value] ?? props.modelValue.pages[0]
  if (!page) throw new Error('expected a page')
  return page
})

const pageId = computed(() => currentPage.value.id)

function goToPage(index: number) {
  const total = props.modelValue.pages.length
  if (total === 0) return
  const next = Math.min(total - 1, Math.max(0, index))
  if (next === pageIndex.value) return
  pageIndex.value = next
  editingPageNumber.value = false
  addMenuOpen.value = false
  clearSelection(selection)
  emitSelection()
}

function beginPageJump() {
  pageNumberDraft.value = String(pageIndex.value + 1)
  editingPageNumber.value = true
  addMenuOpen.value = false
}

function commitPageJump() {
  if (!editingPageNumber.value) return
  const parsed = Number.parseInt(pageNumberDraft.value, 10)
  editingPageNumber.value = false
  if (!Number.isFinite(parsed)) return
  goToPage(parsed - 1)
}

function addPage(mode: 'blank' | 'copy') {
  const index = pageIndex.value
  const created =
    mode === 'blank'
      ? addBlankPage(props.modelValue, index)
      : duplicatePage(props.modelValue, index)
  addMenuOpen.value = false
  if (!created) return
  const next = props.modelValue.pages.indexOf(created)
  pageIndex.value = next >= 0 ? next : index
  clearSelection(selection)
  emitSelection()
  bumpDocument()
}

function removeCurrentPage() {
  if (props.modelValue.pages.length <= 1) return
  const index = pageIndex.value
  if (!deletePage(props.modelValue, index)) return
  pageIndex.value = Math.min(index, props.modelValue.pages.length - 1)
  clearSelection(selection)
  emitSelection()
  bumpDocument()
}

function moveCurrentPage(direction: -1 | 1) {
  const from = pageIndex.value
  const to = from + direction
  if (!movePage(props.modelValue, from, to)) return
  pageIndex.value = to
  bumpDocument()
}

function emitSelection() {
  emit('selectionChange', [...selection.selectedSectionIds])
}

const focusPanelId = ref<string | null>(null)
const focusViewport = ref({ width: 800, height: 600 })

const focusCanvasStyle = computed(() => {
  if (!focusPanelId.value) return {}
  const panel = currentPage.value.sections.find(
    (s) => s.id === focusPanelId.value && s.type === 'panel',
  )
  if (!panel) return {}
  const t = canvasTransformForPanelFocus(currentPage.value, panel, focusViewport.value)
  return {
    transform: t.transform,
    transformOrigin: t.transformOrigin,
  }
})

function enterPanelFocus(panelId: string) {
  const panel = currentPage.value.sections.find((s) => s.id === panelId && s.type === 'panel')
  if (!panel) return
  const rect = pageEl.value?.getBoundingClientRect()
  if (rect && rect.width > 0 && rect.height > 0) {
    focusViewport.value = { width: rect.width, height: rect.height }
  }
  focusPanelId.value = panelId
  selectSection(selection, panelId)
  emitSelection()
  emit('panel-focus-enter', { panelId })
}

function exitPanelFocus() {
  const panelId = focusPanelId.value
  if (!panelId) return
  focusPanelId.value = null
  emit('panel-focus-exit', { panelId })
}

function onSelect(sectionId: string, options: { additive: boolean }) {
  if (!canSelectWhileFocused(focusPanelId.value, sectionId)) {
    return
  }
  if (options.additive) {
    toggleSectionSelection(selection, sectionId)
  } else {
    selectSection(selection, sectionId)
  }
  emitSelection()
}

function onClearSelection() {
  clearSelection(selection)
  emitSelection()
}

function onEditingChange(editing: boolean) {
  if (editing) openPopoverId.value = null
}

function togglePopover(id: ToolId) {
  tools.activate(id)
  const next = openPopoverId.value === id ? null : id
  openPopoverId.value = next
  if (next !== 'layout.select' && next !== 'fonts.manage') {
    pendingDelete.value = null
  }
  if (next === 'layout.save') {
    prepareLayoutSaveForm()
  } else if (next === 'layout.importJson') {
    prepareLayoutImportForm()
  } else {
    pendingOverwrite.value = null
    pendingImportDoc.value = null
  }
}

function prepareLayoutSaveForm() {
  const active = layouts.getActive()
  saveName.value = active && !active.locked ? active.name : ''
  saveError.value = null
  pendingOverwrite.value = null
  pendingImportDoc.value = null
}

function prepareLayoutImportForm() {
  importName.value = ''
  importError.value = null
  importFile.value = null
  pendingOverwrite.value = null
  pendingImportDoc.value = null
  if (importFileInput.value) importFileInput.value.value = ''
}

function onImportFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  importFile.value = input.files?.[0] ?? null
  importError.value = null
}

async function readImportFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text()
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsText(file)
  })
}
function downloadDataUrl(dataUrl: string, filename: string) {
  const anchor = document.createElement('a')
  anchor.href = dataUrl
  anchor.download = filename
  anchor.click()
}

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

async function runExport(format: ExportFormat) {
  if (format === 'png' && props.modelValue.pages.length > 1) {
    await exportAllPagesPng()
    return
  }
  const element = pageEl.value?.querySelector('[data-op-page]') as HTMLElement | null
  element?.classList.add('op-exporting')
  try {
    const result = await exporter.export(format, {
      element: element ?? undefined,
    })
    if (typeof result === 'string') {
      if (format === 'png') {
        downloadDataUrl(result, 'openpages-page.png')
      }
      if (format === 'pdf') {
        downloadDataUrl(result, 'openpages-page.pdf')
      }
    }
  } finally {
    element?.classList.remove('op-exporting')
  }
}

async function exportAllPagesPng() {
  const start = pageIndex.value
  const total = props.modelValue.pages.length
  try {
    for (let i = 0; i < total; i++) {
      pageIndex.value = i
      await nextTick()
      const element = pageEl.value?.querySelector('[data-op-page]') as HTMLElement | null
      element?.classList.add('op-exporting')
      try {
        const result = await exporter.export('png', { element: element ?? undefined })
        if (typeof result === 'string') {
          downloadDataUrl(result, `openpages-page-${i + 1}.png`)
        }
      } finally {
        element?.classList.remove('op-exporting')
      }
    }
  } finally {
    pageIndex.value = start
    await nextTick()
  }
}

async function exportLayoutJson(mode: 'clipboard' | 'download') {
  const text = serializeLayoutSource(props.modelValue)
  tools.activate('layout.exportJson', { mode })
  if (mode === 'clipboard') {
    await navigator.clipboard?.writeText(text)
  } else {
    downloadText(text, 'openpages-layout.json')
  }
  emit('export', { format: 'json', result: text })
  openPopoverId.value = null
}

function activateTool(id: ToolId, payload?: unknown) {
  const extra = (props.extraDocumentTools ?? []).find((tool) => tool.id === id)
  if (extra) {
    emit('toolActivate', { id, payload })
    extra.action?.(payload)
    return
  }

  if (!tools.isEnabled(id)) return

  if (id === 'view.magnet') {
    magnetEnabled.value = !magnetEnabled.value
    tools.activate(id, { enabled: magnetEnabled.value })
    return
  }

  if (
    id === 'layout.select' ||
    id === 'layout.save' ||
    id === 'layout.exportJson' ||
    id === 'layout.importJson' ||
    id === 'fonts.manage' ||
    id === 'page.setup' ||
    id === 'section.add' ||
    id === 'section.style' ||
    id === 'section.font' ||
    id === 'section.columns' ||
    id === 'section.runaround'
  ) {
    tools.activate(id, payload)
    togglePopover(id)
    return
  }

  tools.activate(id, payload)

  if (id === 'export.print') {
    void runExport('print')
    return
  }
  if (id === 'export.png') {
    void runExport('png')
    return
  }
  if (id === 'export.pdf') {
    void runExport('pdf')
    return
  }

  const page = currentPage.value
  const ids = [...selection.selectedSectionIds]
  if (ids.length === 0) return

  switch (id) {
    case 'section.lock': {
      const allLocked = selectedSections.value.every((s) => s.locked)
      for (const sectionId of ids) {
        setSectionLocked(page, sectionId, !allLocked)
      }
      break
    }
    case 'section.hide': {
      const allHidden = selectedSections.value.every((s) => s.hidden)
      for (const sectionId of ids) {
        setSectionHidden(page, sectionId, !allHidden)
      }
      break
    }
    case 'section.duplicate': {
      const onlyId = ids[0]
      if (ids.length !== 1 || !onlyId) break
      const copy = duplicateSection(page, onlyId)
      if (copy) {
        selectSection(selection, copy.id)
        emitSelection()
      }
      break
    }
    case 'section.delete':
      for (const sectionId of ids) {
        deleteSection(page, sectionId)
      }
      clearSelection(selection)
      emitSelection()
      break
    case 'section.zForward':
      for (const sectionId of ids) bringForward(page, sectionId)
      break
    case 'section.zBack':
      for (const sectionId of ids) sendBackward(page, sectionId)
      break
    case 'section.zFront':
      for (const sectionId of ids) bringToFront(page, sectionId)
      break
    case 'section.zBottom':
      for (const sectionId of ids) sendToBack(page, sectionId)
      break
    case 'section.group':
      groupSections(page, ids)
      break
    case 'section.ungroup':
      ungroupSections(page, ids)
      break
    default:
      break
  }
  bumpDocument()
}

function selectLayout(name: string) {
  const chosen = layouts.select(name)
  if (!chosen) return
  emit('update:modelValue', chosen.document)
  emit('update:json', serializeDocument(chosen.document))
  history.reset(serializeDocument(chosen.document))
  setLayoutBaselineFromActive()
  clearSelection(selection)
  emitSelection()
  const missing = missingFontFamilies(chosen.document, catalog.list())
  if (missing.length > 0) {
    missingFontsWarning.value = missing
    emit('fontsMissing', missing)
  } else {
    missingFontsWarning.value = null
  }
  openPopoverId.value = null
}

function dismissFontsMissing() {
  missingFontsWarning.value = null
}

async function addFontFromForm() {
  const label = fontFormLabel.value.trim()
  const source = fontFormSource.value.trim()
  if (!label || !source) return
  const id = slugFontId(label)
  const face = label
  const font: OpenPagesFont = {
    id,
    label,
    family: `'${face.replace(/'/g, '')}', sans-serif`,
    faceName: face,
    source,
    locked: false,
  }
  if (fontFormWeight.value.trim()) font.weight = fontFormWeight.value.trim()
  if (fontFormStyle.value === 'italic') font.style = 'italic'
  const exists = catalog.list().some((entry) => entry.id === id)
  if (props.beforeFontAdd) {
    const allowed = await props.beforeFontAdd({ font, exists })
    if (!allowed) return
  }
  const added = catalog.add(font)
  if (!added) return
  await loadOpenPagesFonts([added])
  fontFormLabel.value = ''
  fontFormSource.value = ''
  fontFormWeight.value = ''
  fontFormStyle.value = 'normal'
}

function removeFont(id: string) {
  const font = catalog.list().find((entry) => entry.id === id)
  if (!font) return
  pendingDelete.value = { kind: 'font', id: font.id, label: font.label }
}

function removeLayout(name: string) {
  pendingDelete.value = { kind: 'layout', name }
}

function cancelPendingDelete() {
  pendingDelete.value = null
}

function confirmPendingDelete() {
  const pending = pendingDelete.value
  pendingDelete.value = null
  if (!pending) return
  if (pending.kind === 'font') {
    catalog.remove(pending.id)
    return
  }
  if (!layouts.remove(pending.name)) return
  const active = layouts.getActive()
  if (active) {
    emit('update:modelValue', active.document)
    emit('update:json', serializeDocument(active.document))
  }
  setLayoutBaselineFromActive()
  clearSelection(selection)
  emitSelection()
}

const pendingDeleteMessage = computed(() => {
  const pending = pendingDelete.value
  if (!pending) return ''
  if (pending.kind === 'layout') {
    return i18n.t('editor.confirmDeleteLayout', { name: pending.name })
  }
  return i18n.t('editor.confirmDeleteFont', { label: pending.label })
})

function applySetupPreset(preset: 'a4' | 'letter' | 'tabloid') {
  applyPagePreset(currentPage.value, preset)
  bumpDocument()
}

function onMarginInput(side: 'top' | 'right' | 'bottom' | 'left', raw: string) {
  const value = Number(raw)
  if (!Number.isFinite(value)) return
  setPageMargins(currentPage.value, { [side]: value })
  bumpDocument()
}

function addSectionOfType(type: SectionType, options?: AddSectionOptions) {
  const created = addSectionToPage(currentPage.value, type, options)
  bumpDocument()
  openPopoverId.value = null
  return created
}

/** Host API: add a section to the current page (optional content / geometry). */
function addSection(type: SectionType, options?: AddSectionOptions) {
  return addSectionOfType(type, options)
}

function patchSelectedStyle(patch: {
  backgroundColor?: string
  color?: string
  borderColor?: string
  borderWidth?: number
}) {
  for (const id of selection.selectedSectionIds) {
    updateSectionStyle(currentPage.value, id, patch)
  }
  bumpDocument()
}

function onRunaroundToggle(checked: boolean) {
  for (const id of selection.selectedSectionIds) {
    setSectionRunaround(currentPage.value, id, checked)
  }
  bumpDocument()
}

function onRunaroundMarginInput(side: 'left' | 'right' | 'top' | 'bottom', raw: string) {
  const value = Number(raw)
  if (!Number.isFinite(value)) return
  for (const id of selection.selectedSectionIds) {
    setSectionRunaroundMargins(currentPage.value, id, { [side]: value })
  }
  bumpDocument()
}

function patchSelectedTextStyle(patch: {
  fontFamily?: string
  fontSize?: number
  fontBold?: boolean
  fontItalic?: boolean
  fontUnderline?: boolean
  fontStrike?: boolean
  columnCount?: number
  lineHeight?: number
  textFit?: 'none' | 'fill'
  textAlign?: TextAlign
  verticalAlign?: VerticalAlign
}) {
  for (const id of selection.selectedSectionIds) {
    updateTextStyle(currentPage.value, id, patch)
  }
  bumpDocument()
}

function selectedFontId(): string {
  const section = primarySelected.value
  if (!section || (section.type !== 'text' && section.type !== 'headline')) return ''
  return (
    matchCatalogFont(fonts.value, {
      family: section.fontFamily,
      fontBold: section.fontBold,
    })?.id ?? ''
  )
}

function onInspectorFontId(id: string) {
  const font = fonts.value.find((entry) => entry.id === id)
  if (!font) return
  patchSelectedTextStyle(applyCatalogFontSelection(font))
}

function bumpSelectedFonts(delta: number) {
  for (const section of selectedSections.value) {
    if (section.type === 'text' || section.type === 'headline') {
      bumpTextSectionFonts(section, delta)
    }
  }
  bumpDocument()
}

const primarySelected = computed(() => selectedSections.value[0] ?? null)

async function saveCurrentLayout(options: { confirmedOverwrite?: boolean } = {}) {
  const name = saveName.value.trim()
  if (!name) return
  saveError.value = null
  const existing = layouts.list().find((layout) => layout.name === name)
  const overwritingOther =
    Boolean(existing) && name !== activeLayoutName.value && existing?.locked !== true
  if (overwritingOther && !options.confirmedOverwrite) {
    pendingOverwrite.value = name
    return
  }
  pendingOverwrite.value = null
  const exists = Boolean(existing)
  if (props.beforeLayoutSave) {
    const allowed = await props.beforeLayoutSave({
      name,
      document: props.modelValue,
      exists,
    })
    if (!allowed) return
  }
  const saved = layouts.save(name, props.modelValue)
  if (!saved) {
    saveError.value = i18n.t('editor.layoutLocked')
    return
  }
  saveName.value = ''
  setLayoutBaselineFromActive()
  openPopoverId.value = null
}

async function importLayoutJson(options: { confirmedOverwrite?: boolean } = {}) {
  const name = importName.value.trim()
  const file = importFile.value ?? importFileInput.value?.files?.[0] ?? null
  if (!name || (!file && !pendingImportDoc.value)) {
    importError.value = i18n.t('editor.importJsonMissing')
    return
  }
  importError.value = null

  let doc = pendingImportDoc.value
  if (!doc) {
    if (!file) {
      importError.value = i18n.t('editor.importJsonMissing')
      return
    }
    try {
      const text = await readImportFileText(file)
      doc = parseDocument(text)
    } catch {
      importError.value = i18n.t('editor.importJsonInvalid')
      return
    }
  }

  const existing = layouts.list().find((layout) => layout.name === name)
  if (existing?.locked) {
    importError.value = i18n.t('editor.layoutLocked')
    return
  }
  const overwriting = Boolean(existing)
  if (overwriting && !options.confirmedOverwrite) {
    pendingImportDoc.value = doc
    pendingOverwrite.value = name
    return
  }

  if (props.beforeLayoutSave) {
    const allowed = await props.beforeLayoutSave({
      name,
      document: doc,
      exists: overwriting,
    })
    if (!allowed) return
  }

  const saved = layouts.save(name, doc)
  if (!saved) {
    importError.value = i18n.t('editor.layoutLocked')
    return
  }
  tools.activate('layout.importJson', { name })
  pendingImportDoc.value = null
  pendingOverwrite.value = null
  importName.value = ''
  importFile.value = null
  if (importFileInput.value) importFileInput.value.value = ''
  selectLayout(name)
}

function confirmOverwriteLayout() {
  if (pendingImportDoc.value) {
    void importLayoutJson({ confirmedOverwrite: true })
    return
  }
  void saveCurrentLayout({ confirmedOverwrite: true })
}

function cancelOverwriteLayout() {
  pendingOverwrite.value = null
  pendingImportDoc.value = null
}

function setToolEnabled(id: ToolId, enabled: boolean) {
  tools.setEnabled(id, enabled)
}

defineExpose({
  activateTool,
  setToolEnabled,
  addSection,
  tools,
  layouts,
  selection,
  enterPanelFocus,
  exitPanelFocus,
  focusPanelId,
})
</script>

<template>
  <OpShadowRoot :extra-styles="shadowStyles">
  <div class="op-editor" data-op-editor>
    <OpenPagesToolbar
      v-if="documentToolbarEntries"
      scope="document"
      :entries="documentToolbarEntries"
      :icons="toolbarIcons"
      :open-popover-id="openPopoverId"
      :active-ids="activeToolIds"
      @activate="activateTool"
      @toggle-popover="togglePopover"
    >
      <template #popover-layout-select>
        <p class="op-popover-title">{{ i18n.t('editor.layouts') }}</p>
        <div
          v-if="pendingDelete?.kind === 'layout'"
          class="op-delete-confirm"
          data-op-delete-confirm
          role="alertdialog"
        >
          <p class="op-delete-confirm-msg">{{ pendingDeleteMessage }}</p>
          <div class="op-delete-confirm-actions">
            <button
              type="button"
              class="op-save-btn"
              data-op-delete-confirm-yes
              @click="confirmPendingDelete"
            >
              {{ i18n.t('editor.confirmYes') }}
            </button>
            <button
              type="button"
              class="op-btn-secondary"
              data-op-delete-confirm-no
              @click="cancelPendingDelete"
            >
              {{ i18n.t('editor.confirmNo') }}
            </button>
          </div>
        </div>
        <ul v-else class="op-layout-list">
          <li v-for="entry in layoutEntries" :key="entry.name" class="op-layout-row">
            <button
              type="button"
              class="op-layout-item"
              :class="{ 'is-active': entry.active }"
              :data-op-layout="entry.name"
              :aria-current="entry.active ? 'true' : undefined"
              @click="selectLayout(entry.name)"
            >
              {{ entry.label }}
            </button>
            <button
              v-if="!entry.locked"
              type="button"
              class="op-layout-delete"
              :data-op-layout-delete="entry.name"
              :aria-label="i18n.t('editor.deleteLayout')"
              @click.stop="removeLayout(entry.name)"
            >
              <Trash2 class="op-delete-icon" aria-hidden="true" />
            </button>
          </li>
        </ul>
        <button
          v-if="pendingDelete?.kind !== 'layout'"
          type="button"
          class="op-save-btn op-layout-export"
          data-op-layout-export
          @click="exportLayoutJson('download')"
        >
          {{ i18n.t('editor.exportJson') }}
        </button>
      </template>
      <template #popover-layout-save>
        <p class="op-popover-title">{{ i18n.t('editor.saveLayout') }}</p>
        <div
          v-if="pendingOverwrite"
          class="op-delete-confirm"
          data-op-overwrite-confirm
          role="alertdialog"
        >
          <p class="op-delete-confirm-msg">
            {{ i18n.t('editor.confirmOverwriteLayout', { name: pendingOverwrite }) }}
          </p>
          <div class="op-delete-confirm-actions">
            <button
              type="button"
              class="op-save-btn"
              data-op-overwrite-confirm-yes
              @click="confirmOverwriteLayout"
            >
              {{ i18n.t('editor.confirmOverwriteYes') }}
            </button>
            <button
              type="button"
              class="op-btn-secondary"
              data-op-overwrite-confirm-no
              @click="cancelOverwriteLayout"
            >
              {{ i18n.t('editor.confirmNo') }}
            </button>
          </div>
        </div>
        <form v-else class="op-save-form" @submit.prevent="saveCurrentLayout()">
          <input
            v-model="saveName"
            class="op-save-input"
            type="text"
            :placeholder="i18n.t('editor.layoutName')"
            :aria-label="i18n.t('editor.layoutName')"
            @input="saveError = null"
          />
          <button type="submit" class="op-save-btn">Save</button>
        </form>
        <p v-if="saveError" class="op-save-error" data-op-save-error>{{ saveError }}</p>
      </template>
      <template #popover-layout-exportJson>
        <p class="op-popover-title">{{ i18n.t('editor.exportJson') }}</p>
        <div class="op-export-json-actions">
          <button
            type="button"
            class="op-save-btn"
            data-op-export-json="clipboard"
            @click="exportLayoutJson('clipboard')"
          >
            Copy to clipboard
          </button>
          <button
            type="button"
            class="op-save-btn"
            data-op-export-json="download"
            @click="exportLayoutJson('download')"
          >
            Download file
          </button>
        </div>
      </template>
      <template #popover-layout-importJson>
        <p class="op-popover-title">{{ i18n.t('editor.importJson') }}</p>
        <div
          v-if="pendingOverwrite && pendingImportDoc"
          class="op-delete-confirm"
          data-op-overwrite-confirm
          role="alertdialog"
        >
          <p class="op-delete-confirm-msg">
            {{ i18n.t('editor.confirmOverwriteLayout', { name: pendingOverwrite }) }}
          </p>
          <div class="op-delete-confirm-actions">
            <button
              type="button"
              class="op-save-btn"
              data-op-overwrite-confirm-yes
              @click="confirmOverwriteLayout"
            >
              {{ i18n.t('editor.confirmOverwriteYes') }}
            </button>
            <button
              type="button"
              class="op-btn-secondary"
              data-op-overwrite-confirm-no
              @click="cancelOverwriteLayout"
            >
              {{ i18n.t('editor.confirmNo') }}
            </button>
          </div>
        </div>
        <form v-else class="op-save-form" @submit.prevent="importLayoutJson()">
          <input
            v-model="importName"
            class="op-save-input"
            type="text"
            data-op-import-name
            :placeholder="i18n.t('editor.layoutName')"
            :aria-label="i18n.t('editor.layoutName')"
            @input="importError = null"
          />
          <label class="op-field">
            {{ i18n.t('editor.importJsonFile') }}
            <input
              ref="importFileInput"
              class="op-save-input"
              type="file"
              accept="application/json,.json"
              data-op-import-file
              @change="onImportFileChange"
            />
          </label>
          <button type="submit" class="op-save-btn" data-op-import-submit>
            {{ i18n.t('editor.importJsonSubmit') }}
          </button>
        </form>
        <p v-if="importError" class="op-save-error" data-op-import-error>{{ importError }}</p>
      </template>
      <template #popover-fonts-manage>
        <p class="op-popover-title">{{ i18n.t('editor.manageFonts') }}</p>
        <div
          v-if="pendingDelete?.kind === 'font'"
          class="op-delete-confirm"
          data-op-delete-confirm
          role="alertdialog"
        >
          <p class="op-delete-confirm-msg">{{ pendingDeleteMessage }}</p>
          <div class="op-delete-confirm-actions">
            <button
              type="button"
              class="op-save-btn"
              data-op-delete-confirm-yes
              @click="confirmPendingDelete"
            >
              {{ i18n.t('editor.confirmYes') }}
            </button>
            <button
              type="button"
              class="op-btn-secondary"
              data-op-delete-confirm-no
              @click="cancelPendingDelete"
            >
              {{ i18n.t('editor.confirmNo') }}
            </button>
          </div>
        </div>
        <div v-else class="op-font-manage-body">
          <ul class="op-font-list">
            <li v-for="font in fonts" :key="font.id" class="op-font-row">
              <span class="op-font-label" :data-op-font="font.id">{{ font.label }}</span>
              <button
                v-if="!font.locked"
                type="button"
                class="op-layout-delete"
                :data-op-font-delete="font.id"
                :aria-label="i18n.t('editor.deleteFont')"
                @click="removeFont(font.id)"
              >
                <Trash2 class="op-delete-icon" aria-hidden="true" />
              </button>
            </li>
          </ul>
          <form class="op-font-add-form" data-op-font-add-form @submit.prevent="addFontFromForm">
            <label class="op-field">
              {{ i18n.t('editor.fontLabel') }}
              <input v-model="fontFormLabel" data-op-font-label type="text" class="op-save-input" />
            </label>
            <label class="op-field">
              {{ i18n.t('editor.fontSource') }}
              <input
                v-model="fontFormSource"
                data-op-font-source
                type="url"
                class="op-save-input"
              />
            </label>
            <label class="op-field">
              {{ i18n.t('editor.fontWeight') }}
              <input
                v-model="fontFormWeight"
                data-op-font-weight
                type="text"
                class="op-save-input"
              />
            </label>
            <label class="op-field">
              {{ i18n.t('editor.fontStyle') }}
              <select v-model="fontFormStyle" data-op-font-style class="op-save-input">
                <option value="normal">normal</option>
                <option value="italic">italic</option>
              </select>
            </label>
            <button type="submit" class="op-save-btn">{{ i18n.t('editor.addFont') }}</button>
          </form>
        </div>
      </template>
      <template #popover-page-setup>
        <p class="op-popover-title">{{ i18n.t('editor.pageSetup') }}</p>
        <div class="op-page-setup">
          <div class="op-page-presets">
            <button
              v-for="preset in (['a4', 'letter', 'tabloid'] as const)"
              :key="preset"
              type="button"
              class="op-save-btn"
              :data-op-page-preset="preset"
              @click="applySetupPreset(preset)"
            >
              {{ preset.toUpperCase() }}
            </button>
          </div>
          <label class="op-field">
            Top
            <input
              data-op-margin="top"
              type="number"
              :value="currentPage.margins.top"
              @change="onMarginInput('top', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="op-field">
            Right
            <input
              data-op-margin="right"
              type="number"
              :value="currentPage.margins.right"
              @change="onMarginInput('right', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="op-field">
            Bottom
            <input
              data-op-margin="bottom"
              type="number"
              :value="currentPage.margins.bottom"
              @change="onMarginInput('bottom', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="op-field">
            Left
            <input
              data-op-margin="left"
              type="number"
              :value="currentPage.margins.left"
              @change="onMarginInput('left', ($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>
      </template>
      <template #popover-section-add>
        <p class="op-popover-title">{{ i18n.t('editor.addSection') }}</p>
        <div class="op-add-types">
          <button
            v-for="type in ([
              'text',
              'headline',
              'image',
              'panel',
              'runaround',
              'balloon',
              'pull-quote',
              'byline',
              'rule',
              'folio',
            ] as const)"
            :key="type"
            type="button"
            class="op-save-btn"
            :data-op-add-type="type"
            @click="addSectionOfType(type)"
          >
            {{ type }}
          </button>
        </div>
      </template>
    </OpenPagesToolbar>

    <div
      v-if="missingFontsWarning?.length"
      class="op-fonts-missing"
      data-op-fonts-missing
      role="alert"
    >
      <p>
        {{
          i18n.t('editor.fontsMissing', {
            fonts: missingFontsWarning.join(', '),
          })
        }}
      </p>
      <button
        type="button"
        class="op-save-btn"
        data-op-fonts-missing-dismiss
        @click="dismissFontsMissing"
      >
        {{ i18n.t('editor.dismissWarning') }}
      </button>
    </div>

    <div
      v-if="focusPanelId"
      class="op-panel-focus-bar"
      data-op-panel-focus-bar
    >
      <button type="button" data-op-panel-focus-exit @click="exitPanelFocus">
        Exit panel focus
      </button>
    </div>
    <div
      ref="pageEl"
      class="op-editor-canvas"
      :class="{ 'is-panel-focus': Boolean(focusPanelId) }"
      data-op-panel-focus-canvas
      @dragover.prevent
      @drop="onCanvasImageDrop"
    >
      <div class="op-editor-canvas-stage" :style="focusCanvasStyle">
      <OpenPagesRenderer
        :document="modelValue"
        :page-id="pageId"
        :selected-section-ids="selection.selectedSectionIds"
        :hovered-section-id="selection.hoveredSectionId"
        :snap-enabled="magnetEnabled"
        :show-hidden="true"
        :fonts="fonts"
        @select="onSelect"
        @clear-selection="onClearSelection"
        @change="bumpDocument"
        @editing-change="onEditingChange"
      >
        <template #selection-chrome>
          <OpenPagesToolbar
            v-if="selectionToolbarEntries"
            scope="selection"
            :entries="selectionToolbarEntries"
            :icons="toolbarIcons"
            :open-popover-id="openPopoverId"
            :active-ids="activeToolIds"
            @activate="activateTool"
            @toggle-popover="togglePopover"
          >
            <template #popover-section-runaround>
              <p class="op-popover-title">{{ i18n.t('tools.section.runaround') }}</p>
              <div class="op-style-form" v-if="primarySelected && primarySelected.type !== 'runaround'">
                <label class="op-field op-field--check">
                  <input
                    data-op-runaround-toggle
                    type="checkbox"
                    :checked="primarySelected.runaround"
                    @change="
                      onRunaroundToggle(($event.target as HTMLInputElement).checked)
                    "
                  />
                  {{ i18n.t('tools.section.runaround') }}
                </label>
                <label class="op-field">
                  {{ i18n.t('editor.runaround.left') }}
                  <input
                    data-op-runaround-margin="left"
                    type="number"
                    :value="primarySelected.runaroundMargins.left"
                    @change="
                      onRunaroundMarginInput(
                        'left',
                        ($event.target as HTMLInputElement).value,
                      )
                    "
                  />
                </label>
                <label class="op-field">
                  {{ i18n.t('editor.runaround.right') }}
                  <input
                    data-op-runaround-margin="right"
                    type="number"
                    :value="primarySelected.runaroundMargins.right"
                    @change="
                      onRunaroundMarginInput(
                        'right',
                        ($event.target as HTMLInputElement).value,
                      )
                    "
                  />
                </label>
                <label class="op-field">
                  {{ i18n.t('editor.runaround.above') }}
                  <input
                    data-op-runaround-margin="top"
                    type="number"
                    :value="primarySelected.runaroundMargins.top"
                    @change="
                      onRunaroundMarginInput(
                        'top',
                        ($event.target as HTMLInputElement).value,
                      )
                    "
                  />
                </label>
                <label class="op-field">
                  {{ i18n.t('editor.runaround.below') }}
                  <input
                    data-op-runaround-margin="bottom"
                    type="number"
                    :value="primarySelected.runaroundMargins.bottom"
                    @change="
                      onRunaroundMarginInput(
                        'bottom',
                        ($event.target as HTMLInputElement).value,
                      )
                    "
                  />
                </label>
              </div>
            </template>
            <template #popover-section-style>
              <p class="op-popover-title">{{ i18n.t('editor.colorsBorder') }}</p>
              <div class="op-style-form" v-if="primarySelected">
                <label class="op-field">
                  Background
                  <div class="op-field-row">
                    <input
                      type="color"
                      :value="
                        primarySelected.backgroundColor === 'transparent'
                          ? '#ffffff'
                          : primarySelected.backgroundColor
                      "
                      @input="
                        patchSelectedStyle({
                          backgroundColor: ($event.target as HTMLInputElement).value,
                        })
                      "
                    />
                    <button
                      type="button"
                      class="op-save-btn"
                      data-op-bg-transparent
                      @click="patchSelectedStyle({ backgroundColor: 'transparent' })"
                    >
                      Transparent
                    </button>
                  </div>
                </label>
                <label class="op-field">
                  Foreground
                  <input
                    type="color"
                    :value="primarySelected.color"
                    @input="patchSelectedStyle({ color: ($event.target as HTMLInputElement).value })"
                  />
                </label>
                <label class="op-field">
                  Border color
                  <input
                    type="color"
                    :value="
                      primarySelected.borderColor === 'transparent'
                        ? '#000000'
                        : primarySelected.borderColor
                    "
                    @input="
                      patchSelectedStyle({
                        borderColor: ($event.target as HTMLInputElement).value,
                      })
                    "
                  />
                </label>
                <label class="op-field">
                  Border width
                  <input
                    type="number"
                    min="0"
                    :value="primarySelected.borderWidth"
                    @change="
                      patchSelectedStyle({
                        borderWidth: Number(($event.target as HTMLInputElement).value),
                      })
                    "
                  />
                </label>
              </div>
            </template>
            <template #popover-section-font>
              <p class="op-popover-title">{{ i18n.t('editor.font') }}</p>
              <div
                class="op-style-form"
                v-if="
                  primarySelected &&
                  (primarySelected.type === 'text' || primarySelected.type === 'headline')
                "
              >
                <label class="op-field">
                  {{ i18n.t('editor.family') }}
                  <select
                    :value="selectedFontId()"
                    @change="onInspectorFontId(($event.target as HTMLSelectElement).value)"
                  >
                    <option v-for="font in fonts" :key="font.id" :value="font.id">
                      {{ font.label }}
                    </option>
                  </select>
                </label>
                <label class="op-field">
                  Size
                  <div class="op-field-row">
                    <input
                      type="number"
                      min="1"
                      step="0.1"
                      :value="primarySelected.fontSize"
                      @change="
                        patchSelectedTextStyle({
                          fontSize: Number(($event.target as HTMLInputElement).value),
                        })
                      "
                    />
                    <button
                      type="button"
                      class="op-save-btn"
                      data-op-font-down
                      @click="bumpSelectedFonts(-2)"
                    >
                      A−
                    </button>
                    <button
                      type="button"
                      class="op-save-btn"
                      data-op-font-up
                      @click="bumpSelectedFonts(2)"
                    >
                      A+
                    </button>
                  </div>
                </label>
                <label class="op-field">
                  Line height
                  <input
                    type="number"
                    min="0.5"
                    step="0.05"
                    :value="primarySelected.lineHeight"
                    @change="
                      patchSelectedTextStyle({
                        lineHeight: Number(($event.target as HTMLInputElement).value),
                      })
                    "
                  />
                </label>
                <label class="op-field op-field--check">
                  <input
                    type="checkbox"
                    :checked="primarySelected.fontBold"
                    @change="
                      patchSelectedTextStyle({
                        fontBold: ($event.target as HTMLInputElement).checked,
                      })
                    "
                  />
                  Bold
                </label>
                <label class="op-field op-field--check">
                  <input
                    type="checkbox"
                    :checked="primarySelected.fontItalic"
                    @change="
                      patchSelectedTextStyle({
                        fontItalic: ($event.target as HTMLInputElement).checked,
                      })
                    "
                  />
                  Italic
                </label>
                <label class="op-field op-field--check">
                  <input
                    type="checkbox"
                    :checked="primarySelected.fontUnderline"
                    @change="
                      patchSelectedTextStyle({
                        fontUnderline: ($event.target as HTMLInputElement).checked,
                      })
                    "
                  />
                  Underline
                </label>
                <label class="op-field op-field--check">
                  <input
                    type="checkbox"
                    :checked="primarySelected.fontStrike"
                    @change="
                      patchSelectedTextStyle({
                        fontStrike: ($event.target as HTMLInputElement).checked,
                      })
                    "
                  />
                  Strike
                </label>
              </div>
            </template>
            <template #popover-section-columns>
              <p class="op-popover-title">{{ i18n.t('editor.columns') }}</p>
              <div
                class="op-style-form"
                v-if="
                  primarySelected &&
                  (primarySelected.type === 'text' || primarySelected.type === 'headline')
                "
              >
                <label class="op-field">
                  Count
                  <input
                    class="op-columns-input"
                    data-op-columns
                    type="number"
                    min="1"
                    max="6"
                    :value="primarySelected.columnCount"
                    @change="
                      patchSelectedTextStyle({
                        columnCount: Number(($event.target as HTMLInputElement).value),
                      })
                    "
                  />
                </label>
                <label class="op-field op-field--check">
                  <input
                    data-op-text-fit
                    type="checkbox"
                    :checked="primarySelected.textFit === 'fill'"
                    @change="
                      patchSelectedTextStyle({
                        textFit: ($event.target as HTMLInputElement).checked ? 'fill' : 'none',
                      })
                    "
                  />
                  {{ i18n.t('editor.fitText') }}
                </label>
                <div class="op-field">
                  {{ i18n.t('editor.alignHorizontal') }}
                  <div class="op-align-row">
                    <button
                      v-for="align in (['left', 'center', 'right', 'justify', 'stretch'] as const)"
                      :key="align"
                      type="button"
                      class="op-align-btn"
                      :class="{ 'is-active': primarySelected.textAlign === align }"
                      :data-op-align-h="align"
                      :title="i18n.t(`editor.align.${align}`)"
                      :aria-label="i18n.t(`editor.align.${align}`)"
                      @click="patchSelectedTextStyle({ textAlign: align })"
                    >
                      <component :is="H_ALIGN_ICONS[align]" class="op-align-icon" :size="16" :stroke-width="2" />
                    </button>
                  </div>
                </div>
                <div class="op-field">
                  {{ i18n.t('editor.alignVertical') }}
                  <div class="op-align-row">
                    <button
                      v-for="align in (['top', 'middle', 'bottom'] as const)"
                      :key="align"
                      type="button"
                      class="op-align-btn"
                      :class="{ 'is-active': primarySelected.verticalAlign === align }"
                      :data-op-align-v="align"
                      :title="i18n.t(`editor.align.${align}`)"
                      :aria-label="i18n.t(`editor.align.${align}`)"
                      @click="patchSelectedTextStyle({ verticalAlign: align })"
                    >
                      <component :is="V_ALIGN_ICONS[align]" class="op-align-icon" :size="16" :stroke-width="2" />
                    </button>
                  </div>
                </div>
              </div>
            </template>
          </OpenPagesToolbar>
        </template>
      </OpenPagesRenderer>
      </div>
    </div>

    <nav
      ref="pageNavEl"
      class="op-page-nav"
      data-op-page-nav
      :aria-label="i18n.t('editor.pages')"
    >      <button
        type="button"
        data-op-page-prev
        :aria-label="i18n.t('editor.previousPage')"
        :disabled="pageIndex === 0"
        @click="goToPage(pageIndex - 1)"
      >
        <ChevronLeft class="op-page-icon" aria-hidden="true" />
      </button>
      <button
        v-if="!editingPageNumber"
        type="button"
        class="op-page-num"
        data-op-page-current
        :aria-label="i18n.t('editor.pageNumber')"
        @click="beginPageJump"
      >
        {{ pageIndex + 1 }}
      </button>
      <input
        v-else
        ref="pageJumpInput"
        class="op-page-jump"
        data-op-page-jump
        type="text"
        inputmode="numeric"
        :aria-label="i18n.t('editor.pageNumber')"
        :value="pageNumberDraft"
        @input="pageNumberDraft = ($event.target as HTMLInputElement).value"
        @keydown.enter.prevent="commitPageJump"
        @blur="commitPageJump"
      />
      <span class="op-page-sep" aria-hidden="true">/</span>
      <span data-op-page-total>{{ pageCount }}</span>
      <button
        type="button"
        data-op-page-next
        :aria-label="i18n.t('editor.nextPage')"
        :disabled="pageIndex >= pageCount - 1"
        @click="goToPage(pageIndex + 1)"
      >
        <ChevronRight class="op-page-icon" aria-hidden="true" />
      </button>
      <div ref="pageAddEl" class="op-page-add">
        <button
          type="button"
          data-op-page-add
          :aria-label="i18n.t('editor.addPage')"
          :aria-expanded="addMenuOpen"
          @click="addMenuOpen = !addMenuOpen"
        >
          <Plus class="op-page-icon" aria-hidden="true" />
        </button>
        <div
          v-if="addMenuOpen"
          class="op-page-add-menu"
          :class="{ 'is-align-end': addMenuAlignEnd }"
          data-op-page-add-menu
        >          <button type="button" data-op-page-add-copy @click="addPage('copy')">
            {{ i18n.t('editor.copyCurrentPage') }}
          </button>
          <button type="button" data-op-page-add-blank @click="addPage('blank')">
            {{ i18n.t('editor.blankPage') }}
          </button>
        </div>
      </div>
      <button
        type="button"
        data-op-page-move-earlier
        :aria-label="i18n.t('editor.movePageEarlier')"
        :disabled="pageIndex === 0"
        @click="moveCurrentPage(-1)"
      >
        <ChevronsLeft class="op-page-icon" aria-hidden="true" />
      </button>
      <button
        type="button"
        data-op-page-move-later
        :aria-label="i18n.t('editor.movePageLater')"
        :disabled="pageIndex >= pageCount - 1"
        @click="moveCurrentPage(1)"
      >
        <ChevronsRight class="op-page-icon" aria-hidden="true" />
      </button>
      <button
        type="button"
        data-op-page-delete
        :aria-label="i18n.t('editor.deletePage')"
        :disabled="pageCount <= 1"
        @click="removeCurrentPage"
      >
        <Trash2 class="op-page-icon" aria-hidden="true" />
      </button>
    </nav>
  </div>
  </OpShadowRoot>
</template>
