import { type OpenPagesDocument, parseDocument, serializeDocument } from './document'
import { createHistory } from './history'
import { addPanelSection, deleteSection, type PanelBorderStyle, type PanelSection } from './section'

export type AddPanelOp = {
  type: 'addPanel'
  pageId: string
  x: number
  y: number
  width: number
  height: number
  borderStyle?: PanelBorderStyle
}

export type RemoveSectionOp = {
  type: 'removeSection'
  pageId: string
  sectionId: string
}

export type DocumentOp = AddPanelOp | RemoveSectionOp

export type ApplyOpOk =
  | { ok: true; op: AddPanelOp; section: PanelSection }
  | { ok: true; op: RemoveSectionOp; sectionId: string }

export type ApplyOpResult = ApplyOpOk | { ok: false; error: string }

export type OpsSession = {
  apply: (op: DocumentOp) => ApplyOpResult
  applyAll: (ops: DocumentOp[]) => ApplyOpResult[]
  undo: () => boolean
  redo: () => boolean
  canUndo: () => boolean
  canRedo: () => boolean
}

function findPage(doc: OpenPagesDocument, pageId: string) {
  return doc.pages.find((page) => page.id === pageId)
}

function hydrateDocument(target: OpenPagesDocument, snapshot: string): void {
  const parsed = parseDocument(snapshot)
  target.schemaVersion = parsed.schemaVersion
  target.meta = { ...parsed.meta }
  target.pages.length = 0
  target.pages.push(...parsed.pages)
  target.assets.length = 0
  target.assets.push(...parsed.assets)
  for (const key of Object.keys(target.data)) {
    delete target.data[key]
  }
  Object.assign(target.data, parsed.data)
}

/** Apply a single document op in place. */
export function applyOp(doc: OpenPagesDocument, op: DocumentOp): ApplyOpResult {
  const page = findPage(doc, op.pageId)
  if (!page) {
    return { ok: false, error: `unknown page: ${op.pageId}` }
  }

  if (op.type === 'addPanel') {
    const section = addPanelSection(page, {
      x: op.x,
      y: op.y,
      width: op.width,
      height: op.height,
      borderStyle: op.borderStyle ?? 'ink',
    })
    return { ok: true, op, section }
  }

  const removed = deleteSection(page, op.sectionId)
  if (!removed) {
    return { ok: false, error: `unknown section: ${op.sectionId}` }
  }
  return { ok: true, op, sectionId: op.sectionId }
}

/** Apply a patch list in order; stops mutating further ops after the first failure. */
export function applyOps(doc: OpenPagesDocument, ops: DocumentOp[]): ApplyOpResult[] {
  const results: ApplyOpResult[] = []
  for (const op of ops) {
    const result = applyOp(doc, op)
    results.push(result)
    if (!result.ok) break
  }
  return results
}

/**
 * Host-facing ops session: apply patch ops with snapshot undo/redo on the same document object.
 */
export function createOpsSession(doc: OpenPagesDocument, options?: { limit?: number }): OpsSession {
  const history = createHistory(options)
  history.push(serializeDocument(doc))

  return {
    apply(op) {
      const result = applyOp(doc, op)
      if (result.ok) {
        history.push(serializeDocument(doc))
      }
      return result
    },
    applyAll(ops) {
      const results = applyOps(doc, ops)
      if (results.length > 0 && results.every((r) => r.ok)) {
        history.push(serializeDocument(doc))
      }
      return results
    },
    undo() {
      const snapshot = history.undo()
      if (!snapshot) return false
      hydrateDocument(doc, snapshot)
      return true
    },
    redo() {
      const snapshot = history.redo()
      if (!snapshot) return false
      hydrateDocument(doc, snapshot)
      return true
    },
    canUndo: () => history.canUndo(),
    canRedo: () => history.canRedo(),
  }
}
