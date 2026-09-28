export type HistoryController = {
  push: (snapshot: string) => void
  undo: () => string | null
  redo: () => string | null
  canUndo: () => boolean
  canRedo: () => boolean
}

/** Bounded undo/redo stack of serialized document snapshots. */
export function createHistory(options?: { limit?: number }): HistoryController {
  const limit = Math.max(1, options?.limit ?? 100)
  const past: string[] = []
  const future: string[] = []
  let present: string | null = null

  return {
    push(snapshot: string) {
      if (snapshot === present) return
      if (present !== null) {
        past.push(present)
        while (past.length > limit) past.shift()
      }
      present = snapshot
      future.length = 0
    },
    undo() {
      if (past.length === 0 || present === null) return null
      future.push(present)
      const previous = past.pop()
      if (previous === undefined) return null
      present = previous
      return present
    },
    redo() {
      if (future.length === 0 || present === null) return null
      past.push(present)
      while (past.length > limit) past.shift()
      const next = future.pop()
      if (next === undefined) return null
      present = next
      return present
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
  }
}
