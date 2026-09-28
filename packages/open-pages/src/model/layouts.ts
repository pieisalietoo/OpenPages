import { type OpenPagesDocument, parseDocument, serializeDocument } from './document'

export interface NamedLayout {
  name: string
  document: OpenPagesDocument
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
  save: (name: string, document: OpenPagesDocument) => NamedLayout
  on: (event: 'layoutChange', listener: (event: LayoutChangeEvent) => void) => () => void
}

function cloneDocument(document: OpenPagesDocument): OpenPagesDocument {
  return parseDocument(serializeDocument(document))
}

export function createLayoutLibrary(options: CreateLayoutLibraryOptions = {}): LayoutLibrary {
  const layouts: NamedLayout[] = (options.layouts ?? []).map((layout) => ({
    name: layout.name,
    document: cloneDocument(layout.document),
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
    return layouts.map((layout) => ({
      name: layout.name,
      document: cloneDocument(layout.document),
    }))
  }

  return {
    list,
    getActive() {
      if (!activeName) return null
      const found = layouts.find((layout) => layout.name === activeName)
      if (!found) return null
      return { name: found.name, document: cloneDocument(found.document) }
    },
    select(name) {
      const found = layouts.find((layout) => layout.name === name)
      if (!found) return null
      activeName = name
      emit()
      return { name: found.name, document: cloneDocument(found.document) }
    },
    save(name, document) {
      const snapshot = cloneDocument(document)
      const existing = layouts.find((layout) => layout.name === name)
      if (existing) {
        existing.document = snapshot
      } else {
        layouts.push({ name, document: snapshot })
      }
      activeName = name
      emit()
      return { name, document: cloneDocument(snapshot) }
    },
    on(_event, listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
