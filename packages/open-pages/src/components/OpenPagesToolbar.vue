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
} from 'lucide-vue-next'
import { computed, defineComponent, h, ref, watch } from 'vue'
import type { ToolbarEntry } from '../tooling/toolbar-order'
import type { ToolDefinition, ToolId, ToolScope } from '../tooling/tools'

/** TextInitial-like glyph with a filled square instead of a letter. */
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
          h('path', { d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' }),
          h('path', { d: 'M14 2v4a2 2 0 0 0 2 2h4' }),
          h('rect', { x: '8', y: '12', width: '8', height: '6', rx: '0.5' }),
        ],
      )
  },
})

const props = defineProps<{
  scope: ToolScope
  entries: ToolbarEntry[]
  openPopoverId?: ToolId | null
  activeIds?: ToolId[]
}>()

const emit = defineEmits<{
  activate: [id: ToolId]
  togglePopover: [id: ToolId]
}>()

const iconMap: Record<string, LucideIcon | typeof TextSquare> = {
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

function iconFor(tool: ToolDefinition) {
  return iconMap[tool.icon] ?? LayoutTemplate
}

const localOpen = ref<ToolId | null>(null)

watch(
  () => props.openPopoverId,
  (value) => {
    localOpen.value = value ?? null
  },
)

const openId = computed(() => props.openPopoverId ?? localOpen.value)

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
  <div class="op-toolbar" :data-op-toolbar="scope" role="toolbar" :aria-label="`${scope} tools`">
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
