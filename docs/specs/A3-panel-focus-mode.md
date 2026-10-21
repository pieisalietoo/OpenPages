# Spec A3 — Panel zoom / focus mode (edit-in)

**Status:** accepted (2026-10-21)  
**Repo:** OpenPages (`@openpages/vue`)  
**Depends on:** A2 clip (recommended); editor selection chrome  
**Unblocks:** ComicsGenerator panel craft (Phase 4); deep work on a single panel

## 1. Context / non-goals

Authors need to **zoom into one panel**, work **fully inside it** (place/move art, balloons, local tools), then **exit** to the page to touch other panels.

**Non-goals (v1):** multi-panel focus; free camera pan outside the panel aspect; editing other panels while still in focus.

## 2. Locked decisions

- Enter focus: editor viewport frames the selected panel bounds; **aspect locked** to that panel; coordinates for interactions are **local to the panel** (or transformed equivalently so host math is panel-relative).
- While focused: **full edit** of content belonging to / clipped by that panel (selection, move/resize of allowed children, image drop into panel, text/balloon edits as already supported).
- Exit focus: restore normal page view; user then selects another panel to focus again.
- Emit host events: `panel-focus-enter` / `panel-focus-exit` with `panelId`.

## 3. Acceptance criteria

- [x] API/UI to enter focus on a panel id and exit to page view.
- [x] In focus, the visible canvas is the panel rectangle (letterbox/pillarbox OK); page chrome outside the panel is not the interaction target for placement.
- [x] Pointer-driven edits use panel-local coordinates (verified by test: drop/place near local 0,0 lands at panel origin).
- [x] Cannot select/edit a different page panel until focus exits (or explicit exit).
- [x] Events `panel-focus-enter` / `panel-focus-exit` fire once per transition.
- [x] Undo/redo still works for edits made while focused (existing history/ops).

## 4. API / surface

```ts
// Editor props / methods (shape flexible)
enterPanelFocus(panelId: string): void
exitPanelFocus(): void
// events
'panel-focus-enter': { panelId: string }
'panel-focus-exit': { panelId: string }
```

Toolbar affordance (icon) optional but recommended in demo editor.

## 5. Test plan (RED)

- Enter/exit toggles focus state; events asserted.
- Local coordinate mapping smoke (synthetic pointer or API place).
- Attempt to select another panel while focused fails or is ignored until exit.
- History: one edit in focus + undo restores prior snapshot.

## 6. Dependencies / order

Review after A2. B6 may ship with a “Focus panel” button once A3 is merged; until then B6 can omit the control.
