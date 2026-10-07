# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2026-10-07

### Added

- Text section **HTML mode** (`htmlMode`): render content as sanitized panel HTML (no line-box engine); source-only editing with a chrome toggle.
- Host `shadowStyles` prop on editor/renderer to inject extra CSS into the OpenPages Shadow DOM after package chrome.
- **Import layout JSON** toolbar tool (`layout.importJson`): name + `.json` file, with overwrite confirm and `beforeLayoutSave` hook support.
- Root `pnpm dev` runs the library watch build (`vite build --watch` → `dist/`) for linked host apps.

### Changed

- README: document that `link:` / published installs resolve `dist/`, so linked hosts need OpenPages `pnpm dev` (or a Vite alias to `src/`).

## [0.4.0] - 2026-10-05

### Added

- Host document toolbar tools via `extraDocumentTools` (id, label, icon, optional action); auto-inserted before the last `grow` unless a custom `documentToolbar` order is provided.
- Host toolbar icon map via `toolbarIcons` so custom icon keys are not limited to built-ins.
- Public `addSection` / `addSectionToPage` API to insert typed sections with optional content and geometry.
- Shadow DOM isolation for editor chrome so host form CSS cannot restyle OpenPages controls (styles injected into the shadow tree).

### Changed

- Split horizontal fill into **justify** (word spacing) and **stretch** (per-line `scaleX`), with matching columns-panel icons.
- Replace `lucide-vue-next` with peer dependency `@lucide/vue` (^1.52). Hosts must install `@lucide/vue` alongside Vue.

### Fixed

- Restore chrome styles inside Shadow DOM after dropping the host stylesheet import.
- Reset undo history when switching named layouts so Ctrl+Z undoes edits, not the layout change.
- Raise the section being text-edited above sibling runarounds so source mode stays readable.
- Flip tool and page-add menus to the left when their trigger sits near the right edge.
- Opaque white background for the inline HTML source editor.
- Runaround toolbar icon rendering.

## [0.3.0] - 2026-10-01

### Added

- Multi-page documents: navigate, add blank or copy pages, reorder, delete, and export PNG per page.
- Resize handles on all corners and edges, with alignment guides and edge snap while resizing.
- Runaround toggle on the selection toolbar so any section can act as an exclusion for neighboring text.
- Text horizontal and vertical alignment in the columns panel (left / center / right / stretch, top / middle / bottom).
- Export layout JSON from the layouts list menu (download current document).

### Fixed

- Stretch horizontal alignment now justifies each laid-out line across the full column width (`text-align-last` + override of `white-space: pre`).

## [0.2.1] - 2026-09-30

### Fixed

- npm publish GitHub Action: use `packageManager` from root `package.json` instead of a conflicting pnpm version pin in `publish.yml`.

## [0.2.0] - 2026-09-29

### Added

- Configurable document/selection toolbar order (`documentToolbar` / `selectionToolbar`) with `sep` and `grow`.
- Layout save prefills the active unlocked name; warns before overwriting a different existing layout.

### Changed

- Font catalog manage UI and layout delete/overwrite hooks (`beforeLayoutSave` / `beforeFontAdd`).

## [0.1.0] - 2026-09-27

### Added

- First public package release of `@openpages/vue` (Vue 3 layout editor/renderer).
- Multi-column text flow, runaround exclusions, inline rich marks, and WYSIWYG line-box editing.
- Host chrome: fonts catalog, i18n (`en` / `it`), layout library, export hooks (print / PNG / PDF).
- Published `dist` build: ESM bundle, compiled CSS, and TypeScript declarations.

[0.5.0]: https://github.com/pieisalietoo/OpenPages/releases/tag/v0.5.0
[0.4.0]: https://github.com/pieisalietoo/OpenPages/releases/tag/v0.4.0
[0.3.0]: https://github.com/pieisalietoo/OpenPages/releases/tag/v0.3.0
[0.2.1]: https://github.com/pieisalietoo/OpenPages/releases/tag/v0.2.1
[0.2.0]: https://github.com/pieisalietoo/OpenPages/releases/tag/v0.2.0
[0.1.0]: https://github.com/pieisalietoo/OpenPages/releases/tag/v0.1.0
