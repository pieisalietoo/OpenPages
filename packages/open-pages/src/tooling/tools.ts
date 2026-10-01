export type ToolScope = 'document' | 'selection'

export type BuiltinToolId =
  | 'layout.select'
  | 'layout.save'
  | 'layout.exportJson'
  | 'fonts.manage'
  | 'page.setup'
  | 'section.add'
  | 'view.magnet'
  | 'export.print'
  | 'export.png'
  | 'export.pdf'
  | 'section.style'
  | 'section.font'
  | 'section.columns'
  | 'section.runaround'
  | 'section.lock'
  | 'section.hide'
  | 'section.duplicate'
  | 'section.delete'
  | 'section.zForward'
  | 'section.zBack'
  | 'section.zFront'
  | 'section.zBottom'
  | 'section.group'
  | 'section.ungroup'

export type ToolId = BuiltinToolId | (string & {})

export interface ToolDefinition {
  id: ToolId
  scope: ToolScope
  label: string
  icon: string
  enabled: boolean
}

export type ToolChangeEvent = { id: ToolId; enabled: boolean }
export type ToolActivateEvent = { id: ToolId; payload?: unknown }

export type ToolEventMap = {
  toolChange: ToolChangeEvent
  toolActivate: ToolActivateEvent
}

export interface CreateToolControllerOptions {
  initialEnabled?: Partial<Record<ToolId, boolean>>
}

type Listener<E extends keyof ToolEventMap> = (event: ToolEventMap[E]) => void

export const BUILTIN_TOOLS: ReadonlyArray<Omit<ToolDefinition, 'enabled'>> = [
  { id: 'layout.select', scope: 'document', label: 'Layouts', icon: 'layout-template' },
  { id: 'layout.save', scope: 'document', label: 'Save layout', icon: 'save' },
  { id: 'layout.exportJson', scope: 'document', label: 'Export JSON', icon: 'braces' },
  { id: 'fonts.manage', scope: 'document', label: 'Fonts', icon: 'book-type' },
  { id: 'export.print', scope: 'document', label: 'Print', icon: 'printer' },
  { id: 'export.png', scope: 'document', label: 'Export PNG', icon: 'image' },
  { id: 'export.pdf', scope: 'document', label: 'Export PDF', icon: 'file-text' },
  { id: 'page.setup', scope: 'document', label: 'Page setup', icon: 'settings' },
  { id: 'section.add', scope: 'document', label: 'Add', icon: 'plus' },
  { id: 'view.magnet', scope: 'document', label: 'Magnet', icon: 'magnet' },
  { id: 'section.style', scope: 'selection', label: 'Colors', icon: 'palette' },
  { id: 'section.font', scope: 'selection', label: 'Font', icon: 'type' },
  { id: 'section.columns', scope: 'selection', label: 'Columns', icon: 'columns-2' },
  { id: 'section.runaround', scope: 'selection', label: 'Runaround', icon: 'text-square' },
  { id: 'section.lock', scope: 'selection', label: 'Lock', icon: 'lock' },
  { id: 'section.hide', scope: 'selection', label: 'Hide', icon: 'eye-off' },
  { id: 'section.duplicate', scope: 'selection', label: 'Duplicate', icon: 'copy' },
  { id: 'section.delete', scope: 'selection', label: 'Delete', icon: 'trash-2' },
  { id: 'section.zForward', scope: 'selection', label: 'Bring forward', icon: 'arrow-up' },
  { id: 'section.zBack', scope: 'selection', label: 'Send back', icon: 'arrow-down' },
  { id: 'section.zFront', scope: 'selection', label: 'Bring to front', icon: 'chevrons-up' },
  { id: 'section.zBottom', scope: 'selection', label: 'Send to back', icon: 'chevrons-down' },
  { id: 'section.group', scope: 'selection', label: 'Group', icon: 'group' },
  { id: 'section.ungroup', scope: 'selection', label: 'Ungroup', icon: 'ungroup' },
]

export interface ToolController {
  list: (scope?: ToolScope) => ToolDefinition[]
  listAll: () => ToolDefinition[]
  setEnabled: (id: ToolId, enabled: boolean) => void
  isEnabled: (id: ToolId) => boolean
  activate: (id: ToolId, payload?: unknown) => void
  on: <E extends keyof ToolEventMap>(event: E, listener: Listener<E>) => () => void
}

export function createToolController(options: CreateToolControllerOptions = {}): ToolController {
  const tools: ToolDefinition[] = BUILTIN_TOOLS.map((tool) => ({
    ...tool,
    enabled: options.initialEnabled?.[tool.id] ?? true,
  }))

  const listeners: { [K in keyof ToolEventMap]: Set<Listener<K>> } = {
    toolChange: new Set(),
    toolActivate: new Set(),
  }

  function find(id: ToolId): ToolDefinition | undefined {
    return tools.find((tool) => tool.id === id)
  }

  function emit<E extends keyof ToolEventMap>(event: E, payload: ToolEventMap[E]) {
    for (const listener of listeners[event]) {
      listener(payload)
    }
  }

  return {
    list(scope) {
      return tools.filter((tool) => tool.enabled && (scope === undefined || tool.scope === scope))
    },
    listAll() {
      return tools.map((tool) => ({ ...tool }))
    },
    setEnabled(id, enabled) {
      const tool = find(id)
      if (!tool || tool.enabled === enabled) {
        return
      }
      tool.enabled = enabled
      emit('toolChange', { id, enabled })
    },
    isEnabled(id) {
      return find(id)?.enabled ?? false
    },
    activate(id, payload) {
      const tool = find(id)
      if (!tool?.enabled) {
        return
      }
      emit('toolActivate', { id, payload })
    },
    on(event, listener) {
      listeners[event].add(listener)
      return () => {
        listeners[event].delete(listener)
      }
    },
  }
}
