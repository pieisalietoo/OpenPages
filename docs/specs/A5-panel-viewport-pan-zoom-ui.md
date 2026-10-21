# Spec A5 — Panel viewport pan/zoom UI

**Status:** accepted (2026-10-21)  
**Repo:** OpenPages (`@openpages/vue`)  
**Depends on:** A2 (rectangular clip)  
**Unblocks:** ComicsGenerator collage framing without host-only controls

## 1. Context / non-goals

A2 clips overflowing panel content. This Spec adds **in-editor UI** to pan/zoom content inside a panel viewport (image/HTML inside panel).

**Non-goals:** non-rectangular clip; host ComicsGenerator duplicate controls (CG uses this UI).

## 2. Locked decisions

- When a panel (or image child in panel) is selected, user can pan and zoom content within the clipped frame.
- Content transform stored on section model (e.g. contentOffset / contentScale fields — exact names in GREEN; migrateDocument if needed).
- Clip remains rectangular (`overflow: hidden`).
- Works with focus mode (A3) when editing inside a panel.

## 3. Acceptance criteria

- [x] UI affordance to pan and zoom clipped image content (Alt+arrows / Alt+=-).
- [x] Transform persists in document JSON round-trip.
- [x] Overflow remains clipped on image section box.
- [x] Unit tests for transform apply + serialize.

## 4. Test plan (RED)

- Setting content scale/offset changes rendered transform.
- serialize/parse preserves fields.
- clip still hides overflow.

## 5. Order

After/with A2 (already implemented). Parallel with A4.
