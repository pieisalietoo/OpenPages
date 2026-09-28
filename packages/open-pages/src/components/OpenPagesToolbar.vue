<script setup lang="ts">
import {
  ArrowDown,
  ArrowUp,
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
  Trash2,
  Type,
  Ungroup,
} from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import type { ToolDefinition, ToolId, ToolScope } from '../tooling/tools'

const props = defineProps<{
  scope: ToolScope
  tools: ToolDefinition[]
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
  braces: Braces,
  settings: Settings,
  plus: Plus,
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
  <div
    class="op-toolbar"
    :class="{ 'op-toolbar--empty': tools.length === 0 }"
    :data-op-toolbar="scope"
    role="toolbar"
    :aria-label="`${scope} tools`"
  >
    <span class="op-toolbar-spacer" data-op-toolbar-spacer aria-hidden="true" />
    <template v-for="tool in tools" :key="tool.id">
      <span
        v-if="tool.id === 'page.setup'"
        class="op-toolbar-sep"
        data-op-toolbar-sep
        aria-hidden="true"
      />
      <div class="op-tool-wrap">
        <button
          type="button"
          class="op-tool-btn"
          :class="{ 'is-active': isActive(tool.id) }"
          :data-op-tool="tool.id"
          :data-op-tool-icon="tool.icon"
          :title="tool.label"
          :aria-label="tool.label"
          :aria-pressed="
            tool.id === 'view.magnet' ||
            tool.id === 'section.lock' ||
            tool.id === 'section.hide'
              ? isActive(tool.id)
                ? 'true'
                : 'false'
              : undefined
          "
          :aria-expanded="openId === tool.id ? 'true' : undefined"
          @click="onClick(tool)"
        >
          <component :is="iconFor(tool)" class="op-tool-icon" aria-hidden="true" />
        </button>
        <div
          v-if="openId === tool.id"
          class="op-tool-popover"
          :data-op-popover="tool.id"
          role="dialog"
          :aria-label="tool.label"
        >
          <slot :name="popoverSlotName(tool.id)" :tool="tool" />
        </div>
      </div>
    </template>
  </div>
</template>
