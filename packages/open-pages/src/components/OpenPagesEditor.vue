<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, reactive, ref, watch } from 'vue'
import {
  createBrowserExportAdapters,
  createExporter,
  type ExportAdapters,
  type ExportFormat,
} from '../export/exporters'
import { createI18n, type LocaleCode, type OpenPagesI18n } from '../i18n'
import { OPEN_PAGES_I18N } from '../i18n/keys'
import { type OpenPagesDocument, parseDocument, serializeDocument } from '../model/document'
import {
  applyCatalogFontSelection,
  BUILTIN_FONTS,
  matchCatalogFont,
  type OpenPagesFont,
} from '../model/fonts'
import { createHistory } from '../model/history'
import { createLayoutLibrary, type LayoutLibrary, type NamedLayout } from '../model/layouts'
import { applyPagePreset, setPageMargins } from '../model/page'
import {
  addHeadlineSection,
  addImageSection,
  addPanelSection,
  addRunaroundSection,
  addTextSection,
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
  ungroupSections,
  updateSectionStyle,
  updateTextStyle,
} from '../model/section'
import {
  clearSelection,
  createSelection,
  selectSection,
  toggleSectionSelection,
} from '../model/selection'
import { visibleSelectionTools } from '../tooling/selection-tools'
import { createToolController, type ToolActivateEvent, type ToolId } from '../tooling/tools'
import OpenPagesRenderer from './OpenPagesRenderer.vue'
import OpenPagesToolbar from './OpenPagesToolbar.vue'

const props = withDefaults(
  defineProps<{
    modelValue: OpenPagesDocument
    json?: string
    toolEnabled?: Partial<Record<ToolId, boolean>>
    layoutLibrary?: LayoutLibrary
    layouts?: NamedLayout[]
    exportAdapters?: ExportAdapters
    fonts?: OpenPagesFont[]
    /** Shared i18n controller (optional). */
    i18n?: OpenPagesI18n
    /** Initial locale when `i18n` is not passed (default `en`). */
    locale?: LocaleCode
  }>(),
  {
    toolEnabled: () => ({}),
    layouts: () => [],
    fonts: () => BUILTIN_FONTS,
    locale: 'en',
  },
)

const emit = defineEmits<{
  'update:modelValue': [OpenPagesDocument]
  'update:json': [string]
  toolActivate: [ToolActivateEvent]
  toolChange: [{ id: ToolId; enabled: boolean }]
  layoutChange: [{ name: string | null }]
  export: [{ format: ExportFormat | 'json'; result: unknown }]
  selectionChange: [string[]]
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
const pageEl = ref<HTMLElement | null>(null)
const applyingJson = ref(false)
const magnetEnabled = ref(true)
const history = createHistory({ limit: 100 })
const applyingHistory = ref(false)

onMounted(() => {
  history.push(serializeDocument(props.modelValue))
  window.addEventListener('keydown', onEditorKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onEditorKeydown)
})

function onEditorKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target?.closest?.('[contenteditable="true"], input, textarea, select')) {
    return
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

const layouts =
  props.layoutLibrary ??
  createLayoutLibrary({
    layouts: props.layouts.length
      ? props.layouts
      : [{ name: 'Current', document: props.modelValue }],
    activeName: props.layouts[0]?.name ?? 'Current',
  })

const exporter = createExporter({
  ...createBrowserExportAdapters(),
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
layouts.on('layoutChange', (event) => emit('layoutChange', { name: event.activeName }))
exporter.on('export', (event) => emit('export', event))

const documentTools = computed(() => {
  toolEpoch.value
  i18n.locale.value
  return tools.list('document').map((tool) => ({
    ...tool,
    label: toolLabel(tool.id, tool.label),
  }))
})

const selectedSections = computed(() =>
  selection.selectedSectionIds
    .map((id) => currentPage.value.sections.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s)),
)

const selectionTools = computed(() => {
  toolEpoch.value
  i18n.locale.value
  const base = visibleSelectionTools(tools.list('selection'), selectedSections.value)
  const allLocked =
    selectedSections.value.length > 0 && selectedSections.value.every((s) => s.locked)
  const allHidden =
    selectedSections.value.length > 0 && selectedSections.value.every((s) => s.hidden)
  return base.map((tool) => {
    if (tool.id === 'section.lock' && allLocked) {
      return { ...tool, icon: 'lock-open', label: i18n.t('tools.section.unlock') }
    }
    if (tool.id === 'section.hide' && allHidden) {
      return { ...tool, icon: 'eye', label: i18n.t('tools.section.show') }
    }
    return { ...tool, label: toolLabel(tool.id, tool.label) }
  })
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
  return ids
})

const pageId = computed(() => {
  const page = props.modelValue.pages[0]
  if (!page) throw new Error('expected a page')
  return page.id
})

const currentPage = computed(() => {
  const page = props.modelValue.pages[0]
  if (!page) throw new Error('expected a page')
  return page
})

const layoutNames = computed(() => layouts.list().map((l) => l.name))

function emitSelection() {
  emit('selectionChange', [...selection.selectedSectionIds])
}

function onSelect(sectionId: string, options: { additive: boolean }) {
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
  openPopoverId.value = openPopoverId.value === id ? null : id
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

async function exportLayoutJson(mode: 'clipboard' | 'download') {
  const text = serializeDocument(props.modelValue)
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
    id === 'page.setup' ||
    id === 'section.add' ||
    id === 'section.style' ||
    id === 'section.font' ||
    id === 'section.columns'
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
  clearSelection(selection)
  emitSelection()
  openPopoverId.value = null
}

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

function addSectionOfType(type: SectionType) {
  const page = currentPage.value
  const x = page.margins.left
  const y = page.margins.top
  switch (type) {
    case 'text':
      addTextSection(page, { x, y, width: 240, height: 80, content: 'New text' })
      break
    case 'headline':
      addHeadlineSection(page, { x, y, width: 360, height: 64, content: 'Headline' })
      break
    case 'image':
      addImageSection(page, {
        x,
        y,
        width: 240,
        height: 160,
        src: 'https://picsum.photos/seed/openpages/480/320',
        alt: 'Image',
        fit: 'cover',
      })
      break
    case 'panel':
      addPanelSection(page, { x, y, width: 200, height: 160, borderStyle: 'ink' })
      break
    case 'runaround':
      addRunaroundSection(page, { x, y, width: 160, height: 120 })
      break
  }
  bumpDocument()
  openPopoverId.value = null
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
    matchCatalogFont(props.fonts, {
      family: section.fontFamily,
      fontBold: section.fontBold,
    })?.id ?? ''
  )
}

function onInspectorFontId(id: string) {
  const font = props.fonts.find((entry) => entry.id === id)
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

function saveCurrentLayout() {
  const name = saveName.value.trim()
  if (!name) return
  layouts.save(name, props.modelValue)
  saveName.value = ''
  openPopoverId.value = null
}

function setToolEnabled(id: ToolId, enabled: boolean) {
  tools.setEnabled(id, enabled)
}

defineExpose({
  activateTool,
  setToolEnabled,
  tools,
  layouts,
  selection,
})
</script>

<template>
  <div class="op-editor" data-op-editor>
    <OpenPagesToolbar
      scope="document"
      :tools="documentTools"
      :open-popover-id="openPopoverId"
      :active-ids="activeToolIds"
      @activate="activateTool"
      @toggle-popover="togglePopover"
    >
      <template #popover-layout-select>
        <p class="op-popover-title">{{ i18n.t('editor.layouts') }}</p>
        <ul class="op-layout-list">
          <li v-for="name in layoutNames" :key="name">
            <button
              type="button"
              class="op-layout-item"
              :data-op-layout="name"
              @click="selectLayout(name)"
            >
              {{ name }}
            </button>
          </li>
        </ul>
      </template>
      <template #popover-layout-save>
        <p class="op-popover-title">{{ i18n.t('editor.saveLayout') }}</p>
        <form class="op-save-form" @submit.prevent="saveCurrentLayout">
          <input
            v-model="saveName"
            class="op-save-input"
            type="text"
            :placeholder="i18n.t('editor.layoutName')"
            :aria-label="i18n.t('editor.layoutName')"
          />
          <button type="submit" class="op-save-btn">Save</button>
        </form>
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
            v-for="type in (['text', 'headline', 'image', 'panel', 'runaround'] as const)"
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

    <div ref="pageEl" class="op-editor-canvas">
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
            scope="selection"
            :tools="selectionTools"
            :open-popover-id="openPopoverId"
            :active-ids="activeToolIds"
            @activate="activateTool"
            @toggle-popover="togglePopover"
          >
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
                <label class="op-field op-field-check">
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
              </div>
            </template>
          </OpenPagesToolbar>
        </template>
      </OpenPagesRenderer>
    </div>
  </div>
</template>
