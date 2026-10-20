# OpenPages — decisions

## 2026-10-20 — ComicsGenerator Spec pack A

Locked with ComicsGenerator planning session:

1. **Panel flow (A1):** L→R / T→B reading order; merge & split allowed; add/remove redistributes remaining panels; preserve section ids where possible (not “blind re-apply preset only”).
2. **Viewport (A2):** rectangular CSS `overflow: hidden` only in v1; no SVG/non-rect masks.
3. **Focus (A3):** edit-in single panel; exit zoom to work on other panels.

See [SPECS.md](./SPECS.md).
