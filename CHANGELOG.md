# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.2.0]: https://github.com/pieisalietoo/OpenPages/releases/tag/v0.2.0
[0.1.0]: https://github.com/pieisalietoo/OpenPages/releases/tag/v0.1.0
