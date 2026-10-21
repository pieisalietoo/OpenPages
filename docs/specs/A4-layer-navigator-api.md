# Spec A4 — Layer navigator API

**Status:** accepted (2026-10-21)  
**Repo:** OpenPages (`@openpages/vue`)  
**Depends on:** existing section z-order / visibility / lock helpers  
**Unblocks:** ComicsGenerator inspector layer list (host consumes API)

## 1. Context / non-goals

Expose a first-class **layer list** API for the active page: ordered sections with visibility/lock, reorder, select.

**Non-goals:** Photoshop-style effects; non-rect masks; host-only duplicate list without this API (CG will consume this).

## 2. Locked decisions

- API returns ordered layer descriptors: `{ id, type, name?, hidden, locked, groupId? }`.
- Operations: reorder (bring forward/back / to front/back already exist — wrap as layer ops), setHidden, setLocked.
- Editor UI: optional layer panel chrome in OpenPages (minimal list) so CG can also bind host inspector to the same functions.
- Emit selection when layer row activated.

## 3. Acceptance criteria

- [x] Pure functions / composable: `listPageLayers(page)`, layer bring/send + visibility/lock setters exported from package entry.
- [x] Unit tests for order after reorder and hidden/locked flags.
- [x] Host can bind inspector to the same API (minimal editor list optional; API is the contract).

## 4. Test plan (RED)

- list layers matches section order.
- reorder changes order deterministically.
- setHidden/setLocked persist on section.

## 5. Order

Before CG wires inspector layer list. Parallel with A5.
