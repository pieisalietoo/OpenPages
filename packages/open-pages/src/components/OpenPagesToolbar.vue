<script setup lang="ts">
import {
  ArrowDown,
  ArrowUp,
  BookType,
  Braces,
  ChevronsDown,
  ChevronsUp,
  Columns2,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Group,
  Image,
  LayoutTemplate,
  Lock,
  LockOpen,
  type LucideIcon,
  Magnet,
  Palette,
  Plus,
  Printer,
  Save,
  Settings,
  SquarePlus,
  Trash2,
  Type,
  Ungroup,
} from '@lucide/vue'
import {
  type Component,
  computed,
  defineComponent,
  h,
  markRaw,
  nextTick,
  ref,
  toRaw,
  watch,
} from 'vue'
import { POPOVER_MIN_WIDTH_PX, shouldAlignPopoverEnd } from '../tooling/popover-align'
import type { ToolbarEntry } from '../tooling/toolbar-order'
import type { ToolDefinition, ToolId, ToolScope } from '../tooling/tools'

/** Host-provided icon components keyed like built-in Lucide keys (`sparkles`, …). */
export type ToolbarIconMap = Record<string, Component>

/** TextInitial-like: drop-cap square top-left with wrap lines to the right and below. */
const TextSquare = defineComponent({
  name: 'TextSquare',
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
          class: 'lucide op-tool-icon',
          'aria-hidden': 'true',
        },
        [
          // ~3/7 drop-cap square (replaces Lucide TextInitial's "A")
          h('rect', { x: '3', y: '3', width: '9', height: '9', rx: '0.5' }),
          h('path', { d: 'M15 5h6' }),
          h('path', { d: 'M15 12h6' }),
          h('path', { d: 'M3 19h18' }),
        ],
      )
  },
})

const props = withDefaults(
  defineProps<{
    scope: ToolScope
    entries: ToolbarEntry[]
    openPopoverId?: ToolId | null
    activeIds?: ToolId[]
    /** Extra / override icons merged into the built-in map (host keys win). */
    icons?: ToolbarIconMap
  }>(),
  {
    icons: () => ({}),
  },
)

const emit = defineEmits<{
  activate: [id: ToolId]
  togglePopover: [id: ToolId]
}>()

const BUILTIN_ICON_MAP: Record<string, LucideIcon | typeof TextSquare> = {
  'layout-template': LayoutTemplate,
  save: Save,
  'book-type': BookType,
  braces: Braces,
  settings: Settings,
  plus: SquarePlus,
  magnet: Magnet,
  printer: Printer,
  image: Image,
  'file-text': FileText,
  palette: Palette,
  type: Type,
  'columns-2': Columns2,
  'text-square': TextSquare,
  lock: Lock,
  'lock-open': LockOpen,
  'eye-off': EyeOff,
  eye: Eye,
  copy: Copy,
  'trash-2': Trash2,
  'arrow-up': ArrowUp,
  'arrow-down': ArrowDown,
  'chevrons-up': ChevronsUp,
  'chevrons-down': ChevronsDown,
  group: Group,
  ungroup: Ungroup,
}

const iconMap = computed(() => {
  const extras: ToolbarIconMap = {}
  for (const [key, icon] of Object.entries(props.icons ?? {})) {
    extras[key] = markRaw(toRaw(icon))
  }
  return { ...BUILTIN_ICON_MAP, ...extras }
})

function iconFor(tool: ToolDefinition) {
  const icon = iconMap.value[tool.icon] ?? LayoutTemplate
  return markRaw(toRaw(icon))
}

const localOpen = ref<ToolId | null>(null)

watch(
  () => props.openPopoverId,
  (value) => {
    localOpen.value = value ?? null
  },
)

const openId = computed(() => props.openPopoverId ?? localOpen.value)
const alignEnd = ref(false)
const toolbarEl = ref<HTMLElement | null>(null)

watch(
  openId,
  async (id) => {
    alignEnd.value = false
    if (!id) return
    await nextTick()
    const toolbar = toolbarEl.value
    if (!toolbar) return
    const btn = toolbar.querySelector(`[data-op-tool="${id}"]`) as HTMLElement | null
    const wrap = btn?.closest('.op-tool-wrap') as HTMLElement | null
    if (!wrap) return
    const anchor = wrap.getBoundingClientRect()
    const container = toolbar.getBoundingClientRect()
    alignEnd.value = shouldAlignPopoverEnd({
      anchorLeft: anchor.left,
      containerRight: container.right,
      minWidth: POPOVER_MIN_WIDTH_PX,
    })
  },
  { flush: 'post' },
)

const popoverTools = new Set<ToolId>([
  'layout.select',
  'layout.save',
  'layout.exportJson',
  'fonts.manage',
  'page.setup',
  'section.add',
  'section.style',
  'section.font',
  'section.columns',
])

const toggleTools = new Set<ToolId>([
  'view.magnet',
  'section.lock',
  'section.hide',
  'section.runaround',
])

function onClick(tool: ToolDefinition) {
  if (popoverTools.has(tool.id)) {
    emit('togglePopover', tool.id)
    return
  }
  emit('activate', tool.id)
}

function popoverSlotName(id: ToolId): string {
  return `popover-${String(id).replace(/\./g, '-')}`
}

function isActive(id: ToolId): boolean {
  return (props.activeIds ?? []).includes(id)
}

function isToggle(id: ToolId): boolean {
  return toggleTools.has(id)
}
</script>

<template>
  <div
    ref="toolbarEl"
    class="op-toolbar"
    :data-op-toolbar="scope"
    role="toolbar"
    :aria-label="`${scope} tools`"
  >
    <template v-for="(entry, index) in entries" :key="`${entry.kind}-${index}`">
      <span
        v-if="entry.kind === 'sep'"
        class="op-toolbar-sep"
        data-op-toolbar-sep
        aria-hidden="true"
      />
      <span
        v-else-if="entry.kind === 'grow'"
        class="op-toolbar-grow"
        data-op-toolbar-grow
        aria-hidden="true"
      />
      <div v-else class="op-tool-wrap">
        <button
          type="button"
          class="op-tool-btn"
          :class="{ 'is-active': isActive(entry.tool.id) }"
          :data-op-tool="entry.tool.id"
          :data-op-tool-icon="entry.tool.icon"
          :title="entry.tool.label"
          :aria-label="entry.tool.label"
          :aria-pressed="
            isToggle(entry.tool.id) ? (isActive(entry.tool.id) ? 'true' : 'false') : undefined
          "
          :aria-expanded="openId === entry.tool.id ? 'true' : undefined"
          @click="onClick(entry.tool)"
        >
          <component :is="iconFor(entry.tool)" class="op-tool-icon" aria-hidden="true" />
        </button>
        <div
          v-if="openId === entry.tool.id"
          class="op-tool-popover"
          :class="{ 'is-align-end': alignEnd }"
          :data-op-popover="entry.tool.id"
          role="dialog"
          :aria-label="entry.tool.label"
        >
          <slot :name="popoverSlotName(entry.tool.id)" :tool="entry.tool" />
        </div>
      </div>
    </template>
  </div>
</template>
