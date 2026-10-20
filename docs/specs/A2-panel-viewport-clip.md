# Spec A2 — Panel viewport clip (rectangular)

**Status:** accepted (2026-10-21)  
**Repo:** OpenPages (`@openpages/vue`)  
**Depends on:** Panel section type (done)  
**Unblocks:** ComicsGenerator panel art that must not spill outside the panel frame; B6 embed

## 1. Context / non-goals

Comic panels act as **viewports**: content drawn “inside” a panel (images, nested chrome) must be **clipped** to the panel rectangle.

**Non-goals (v1):** non-rectangular masks, SVG clip-paths, feathered edges, arbitrary polygon holes.

## 2. Locked decisions

- Spike outcome: use **CSS `overflow: hidden`** on the panel section box.
- New optional flag on panel sections: `clipContent` (boolean), **default `true`**.
- When `clipContent === false`, overflow may paint outside (debug / special layouts).

## 3. Acceptance criteria

- [ ] `PanelSection` includes `clipContent: boolean` (default true on create / parse migrate).
- [ ] Renderer applies `overflow: hidden` (or equivalent) when `clipContent` is true.
- [ ] Child / overlapping content that extends past panel bounds is not visible outside the panel box in the editor canvas and export HTML path that uses the same renderer styles.
- [ ] Toggling `clipContent` to false is observable in a unit/DOM test (overflow visible).
- [ ] Documented in package README or SPECS index for hosts.

## 4. API / surface

- Model: `clipContent` on `PanelSection`; parse/serialize round-trip.
- Optional op: `setPanelClipContent { pageId, sectionId, clipContent }`.
- No new host adapter required beyond existing section style updates if a generic patch already exists.

## 5. Test plan (RED)

- New panel from `addPanelSection` / layout preset has `clipContent === true`.
- Parse older JSON without field → migrates to `true`.
- Renderer/CSS contract test: panel root has overflow hidden when clipped.
- `clipContent: false` → overflow not hidden.

## 6. Dependencies / order

After **A1** accept in review pack; implement before or with B6. Review: A1 → **A2** → A3.
