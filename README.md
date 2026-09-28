# OpenPages

Embeddable Vue 3 layout engine for comics, newspapers, magazines, and similar print-inspired pages — sections with rich in-place format tooling, multi-column text flow, and avoidance zones for overlapping content.

**Stack:** Vue 3 · Tailwind CSS · Lucide icons · TypeScript · MIT

## Requirements

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+ (the repo pins `pnpm@12` via `packageManager`)
- A Vue 3 host app (peer dependency: `vue ^3.5`)

## Usage

### Install

When consuming a published release:

```bash
pnpm add @openpages/vue
# or: npm install @openpages/vue
```

Until a release is published, depend on a git checkout or a local path (see [Link a host app to local sources](#link-a-host-app-to-local-sources)).

Published installs resolve the compiled `dist/` build (`open-pages.js`, `open-pages.css`, and `.d.ts`). Local `pnpm demo` still aliases to package sources for HMR.

### Minimal editor

Import the package stylesheet once in your app (it pulls in Tailwind utilities used by the chrome):

```ts
// main.ts / style entry
import '@openpages/vue/style.css'
```

Then mount the editor:

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

Your Vite (or equivalent) config must compile Vue SFCs from the package. A typical Vite host already has `@vitejs/plugin-vue`. If you import `@openpages/vue/style.css`, also enable Tailwind v4 in the host (for example `@tailwindcss/vite`), matching the demo app.

### Host-controlled chrome

`OpenPagesEditor` supports host-driven tooling without forking the package:

| Capability | How |
|------------|-----|
| Enable / disable tools | `toolEnabled` prop or `setToolEnabled(id, false)` |
| Activate a tool from outside | `activateTool(id, payload)` + `@tool-activate` |
| Named layouts | `createLayoutLibrary` / `layoutLibrary` |
| Fonts | `createFontCatalog` / `fonts` prop; `loadOpenPagesFonts` for custom faces |
| Locale | `createI18n` / `i18n` prop (built-in `en` / `it`) |
| Export | print / PNG / PDF via `@export`; inject `exportAdapters` for pixel PNG |

Document tools sit on the top toolbar; selection tools float above the selected section(s).

### Demo playground

Clone this repo and run the built-in demo to explore layouts, fonts, custom faces, and language switching:

```bash
pnpm install
pnpm demo
```

Opens at [http://localhost:5173](http://localhost:5173).

## Development

This monorepo layout:

```text
apps/demo              # Vite playground (@openpages/demo)
packages/open-pages    # Library package (@openpages/vue)
scripts/               # gatekeeper and helpers
```

### Setup

```bash
git clone https://github.com/pieisalietoo/OpenPages.git
cd OpenPages
pnpm install
```

### Common commands

```bash
pnpm demo          # playground
pnpm test          # Vitest (@openpages/vue)
pnpm typecheck     # vue-tsc for library + demo
pnpm lint          # Biome
pnpm build         # library build
pnpm gatekeeper    # lint + typecheck + test (full local gate)
```

Package-scoped scripts also work from `packages/open-pages` (`pnpm test`, `pnpm test:watch`, …).

### Link a host app to local sources

`@openpages/vue` currently exposes TypeScript / `.vue` sources directly (no publish step required for day-to-day host work). Point your other app at the local package so edits in OpenPages hot-reload into the host without bumping versions.

#### Option A — pnpm `link:` (recommended)

In the **host** app `package.json`:

```json
{
  "dependencies": {
    "@openpages/vue": "link:../OpenPages/packages/open-pages"
  }
}
```

Adjust the relative path to wherever you cloned OpenPages. Then:

```bash
# in the host app
pnpm install
pnpm dev
```

Keep the OpenPages repo open in another editor/window; save files under `packages/open-pages/src` and the host Vite server should pick them up.

#### Option B — Vite alias (no package manager link)

Keep a normal dependency entry (or omit it) and force resolution in the **host** `vite.config.ts`:

```ts
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const openPagesRoot = path.resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../OpenPages/packages/open-pages',
)

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@openpages/vue': path.join(openPagesRoot, 'src/index.ts'),
      '@openpages/vue/style.css': path.join(openPagesRoot, 'src/style.css'),
    },
    // Critical: one Vue copy shared by host + OpenPages
    dedupe: ['vue'],
  },
  server: {
    fs: {
      allow: [openPagesRoot],
    },
  },
  optimizeDeps: {
    exclude: ['@openpages/vue'],
  },
})
```

#### Vue / Tailwind checklist for linked hosts

1. **Single Vue instance** — use `resolve.dedupe: ['vue']` (and avoid nested `node_modules/vue` inside the linked package when possible). Duplicate Vue causes “invalid vnode” / broken reactivity.
2. **Compile SFCs** — host must run `@vitejs/plugin-vue` so `.vue` files under OpenPages compile.
3. **Styles** — import `@openpages/vue/style.css` and enable Tailwind v4 in the host (see `apps/demo`).
4. **Two terminals** — run the host `dev` server and edit OpenPages sources; no `pnpm build` / version bump of `@openpages/vue` is required for this workflow.

When you are ready to ship the host against a fixed OpenPages revision, switch the dependency back to a published version, a git tag, or a path commit — and remove the alias / `link:` override.

## License

**MIT**. See [LICENSE](./LICENSE).
