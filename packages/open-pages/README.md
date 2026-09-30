# @openpages/vue

Embeddable Vue 3 layout engine for comics, newspapers, magazines, and similar print-inspired pages — sections with rich in-place format tooling, multi-column text flow, and avoidance zones for overlapping content.

**Stack:** Vue 3 · TypeScript · MIT

## Install

```bash
pnpm add @openpages/vue
# or: npm install @openpages/vue
# or: yarn add @openpages/vue
```

**Peer dependency:** `vue` `^3.5`  
**Node:** `>=22.14.0`

## Quick start

Import the package stylesheet once (compiled chrome styles):

```ts
import '@openpages/vue/style.css'
```

Mount the editor:

```vue
<script setup lang="ts">
import { createDocument, OpenPagesEditor, type OpenPagesDocument } from '@openpages/vue'
import { ref } from 'vue'

const doc = ref<OpenPagesDocument>(createDocument({ title: 'Untitled' }))
</script>

<template>
  <OpenPagesEditor v-model="doc" />
</template>
```

Your host must compile Vue SFCs (`@vitejs/plugin-vue` or equivalent).

## Host-controlled chrome

`OpenPagesEditor` supports host-driven tooling without forking the package:

| Capability | How |
|------------|-----|
| Enable / disable tools | `toolEnabled` prop or `setToolEnabled(id, false)` |
| Activate a tool from outside | `activateTool(id, payload)` + `@tool-activate` |
| Named layouts | `createLayoutLibrary` / `layoutLibrary` |
| Fonts | `createFontCatalog` / `fontCatalog` or `fonts` prop; `loadOpenPagesFonts` for custom faces |
| Locale | `createI18n` / `i18n` prop (built-in `en` / `it`) |
| Export | print / PNG / PDF via `@export`; inject `exportAdapters` for pixel PNG |

Document tools sit on the top toolbar; selection tools float above the selected section(s).

## Exports

```ts
import {
  OpenPagesEditor,
  OpenPagesRenderer,
  OpenPagesToolbar,
  createDocument,
  createI18n,
  createFontCatalog,
  createLayoutLibrary,
  createExporter,
  createBrowserExportAdapters,
  // …section helpers, fonts, snap, tooling
} from '@openpages/vue'

import '@openpages/vue/style.css'
```

Types ship with the package (`dist/index.d.ts`).

## Docs & demo

- Source and contribution guide: [OpenPages](https://github.com/pieisalietoo/OpenPages)
- Issues: [GitHub Issues](https://github.com/pieisalietoo/OpenPages/issues)

Clone the repo and run `pnpm demo` for an interactive playground.

## License

MIT
