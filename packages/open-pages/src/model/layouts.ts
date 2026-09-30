import { type OpenPagesDocument, parseDocument, serializeDocument } from './document'

export interface NamedLayout {
  name: string
  document: OpenPagesDocument
  /** When true at load time, save/remove are refused. Missing → unlocked. */
  locked?: boolean
}

export type LayoutChangeEvent = {
  activeName: string | null
  layouts: NamedLayout[]
}

export interface CreateLayoutLibraryOptions {
  layouts?: NamedLayout[]
  activeName?: string
}

export interface LayoutLibrary {
  list: () => NamedLayout[]
  getActive: () => NamedLayout | null
  select: (name: string) => NamedLayout | null
  save: (name: string, document: OpenPagesDocument) => NamedLayout | null
  remove: (name: string) => boolean
  on: (event: 'layoutChange', listener: (event: LayoutChangeEvent) => void) => () => void
}

function cloneDocument(document: OpenPagesDocument): OpenPagesDocument {
  return parseDocument(serializeDocument(document))
}

function cloneLayout(layout: NamedLayout): NamedLayout {
  return {
    name: layout.name,
    document: cloneDocument(layout.document),
    locked: layout.locked === true,
  }
}

export function createLayoutLibrary(options: CreateLayoutLibraryOptions = {}): LayoutLibrary {
  const layouts: NamedLayout[] = (options.layouts ?? []).map((layout) => ({
    name: layout.name,
    document: cloneDocument(layout.document),
    locked: layout.locked === true,
  }))
  let activeName: string | null =
    options.activeName && layouts.some((l) => l.name === options.activeName)
      ? options.activeName
      : (layouts[0]?.name ?? null)

  const listeners = new Set<(event: LayoutChangeEvent) => void>()

  function emit() {
    const event: LayoutChangeEvent = {
      activeName,
      layouts: list(),
    }
    for (const listener of listeners) {
      listener(event)
    }
  }

  function list(): NamedLayout[] {
    return layouts.map(cloneLayout)
  }

  return {
    list,
    getActive() {
      if (!activeName) return null
      const found = layouts.find((layout) => layout.name === activeName)
      if (!found) return null
      return cloneLayout(found)
    },
    select(name) {
      const found = layouts.find((layout) => layout.name === name)
      if (!found) return null
      activeName = name
      emit()
      return cloneLayout(found)
    },
    save(name, document) {
      const snapshot = cloneDocument(document)
      const existing = layouts.find((layout) => layout.name === name)
      if (existing) {
        if (existing.locked) return null
        existing.document = snapshot
      } else {
        layouts.push({ name, document: snapshot, locked: false })
      }
      activeName = name
      emit()
      return cloneLayout({ name, document: snapshot, locked: existing?.locked ?? false })
    },
    remove(name) {
      const index = layouts.findIndex((layout) => layout.name === name)
      if (index < 0) return false
      const target = layouts[index]
      if (!target || target.locked) return false
      layouts.splice(index, 1)
      if (activeName === name) {
        activeName = layouts[0]?.name ?? null
      }
      emit()
      return true
    },
    on(_event, listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
