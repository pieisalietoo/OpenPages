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
import { computed, ref, watch } from 'vue'
import type { ToolbarEntry } from '../tooling/toolbar-order'
import type { ToolDefinition, ToolId, ToolScope } from '../tooling/tools'

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

const iconMap: Record<string, LucideIcon> = {
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

function iconFor(tool: ToolDefinition): LucideIcon {
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
            entry.tool.id === 'view.magnet' ||
            entry.tool.id === 'section.lock' ||
            entry.tool.id === 'section.hide'
              ? isActive(entry.tool.id)
                ? 'true'
                : 'false'
              : undefined
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
