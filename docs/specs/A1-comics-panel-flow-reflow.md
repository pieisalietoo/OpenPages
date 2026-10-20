# Spec A1 — Comics panel flow + reflow

**Status:** accepted (2026-10-21)  
**Repo:** OpenPages (`@openpages/vue`)  
**Depends on:** E2 layout presets (done), H1 ops `addPanel` / `removeSection` (done)  
**Unblocks:** ComicsGenerator B6 page layout; host panel add/remove with stable reading order

## 1. Context / non-goals

Hosts (ComicsGenerator) need a **page of panels** with a fixed **reading flow** (left→right, top→bottom). Users pick an initial grid, then **merge**, **split**, **add**, or **remove** panels; remaining panels **redistribute** while keeping flow order. Section ids and nested content should be preserved where possible.

**Non-goals (v1):** custom non-linear flows (RTL, Z-path overrides); free-form balloon reflow as geometry; automatic reflow of non-panel sections.

## 2. Locked decisions

- Reading order is always **L→R, T→B** (reading index `0..n-1`).
- Initial layout comes from a comic preset (or equivalent grid) that assigns flow indices.
- **Merge:** adjacent panels in flow/geometry → one larger panel; survivors keep one canonical id (prefer lowest reading index).
- **Split:** one panel → N panels that occupy successive flow slots.
- **Add / remove:** remaining panels redistribute into the page content box (margins + gutters); prefer **stable ids** and keep child/nested content on surviving panels.
- Explicit `reflowPage` op allowed; add/remove/merge/split also trigger reflow of panel geometry.

## 3. Acceptance criteria

- [x] A page can store an ordered panel flow (`readingIndex` or equivalent) for all `type === 'panel'` sections.
- [x] Applying a comic layout preset initializes flow indices in L→R/T→B order.
- [x] `mergePanels(page, panelIds)` produces one panel whose box is the union (or grid-slot union) of inputs; removed ids gone; flow reindexed densely `0..n-1`.
- [x] `splitPanel(page, panelId, parts)` creates `parts` panels (≥2) covering the original box; flow inserts them in place of the original index.
- [x] `addPanelInFlow` / `removePanelFromFlow` change count and **redistribute** all panel boxes in flow order within the content box (gutters preserved from last layout options or defaults).
- [x] After redistribute, surviving panel **ids** that still exist keep the same id; new panels get new ids.
- [x] Non-panel sections are left in place (not deleted by reflow).
- [x] Ops are available via `applyOp` / documented host API and covered by unit tests (no flake / no DOM).

## 4. API / surface (proposed)

```ts
type PanelFlowOptions = { gutter?: number }

setPagePanelFlow(page, panelIdsInReadingOrder): void
mergePanels(page, panelIds: string[], options?: PanelFlowOptions): PanelSection
splitPanel(page, panelId: string, parts: number, options?: PanelFlowOptions): PanelSection[]
addPanelInFlow(page, atIndex?: number, options?: PanelFlowOptions): PanelSection
removePanelFromFlow(page, panelId: string, options?: PanelFlowOptions): boolean
reflowPagePanels(page, options?: PanelFlowOptions): PanelSection[]
```

Optional DocumentOp variants mirroring the above for `createOpsSession`.

Persist enough state to reflow later: e.g. last `gutter` and that the page is in “panel flow” mode (flag or inferred from presence of flow metadata).

## 5. Test plan (RED)

- Preset `comic-2x2` → four panels, indices 0–3, L→R/T→B geometry.
- Remove one panel → three panels reflowed; remaining ids unchanged.
- Add panel → count+1; boxes fill content area with gutters.
- Merge two adjacent → one panel; id of primary survivor stable.
- Split one into two → two panels in former slot range; flow dense.
- Non-panel text section unchanged across reflow.

## 6. Dependencies / order

Implement after this Spec is **accepted**. Review order: **A1 → A2 → A3**. ComicsGenerator B6 should pin a release that includes A1.
