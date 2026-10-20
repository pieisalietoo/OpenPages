# OpenPages

Embeddable Vue 3 layout engine for comics, newspapers, magazines, and similar print-inspired pages — sections with rich in-place format tooling, multi-column text flow, and avoidance zones for overlapping content.

**Stack:** Vue 3 · Tailwind CSS · Lucide icons · TypeScript · MIT

**Specs (ComicsGenerator blockers):** [docs/SPECS.md](./docs/SPECS.md) · [docs/comicsgenerator-blockers.md](./docs/comicsgenerator-blockers.md)

## Requirements

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+ (the repo pins `pnpm@12` via `packageManager`)
- A Vue 3 host app (peer dependencies: `vue ^3.5`, `@lucide/vue ^1.52`)

## Usage

### Install

When consuming a published release:

```bash
pnpm add @openpages/vue @lucide/vue vue
# or: npm install @openpages/vue @lucide/vue vue
```

Until a release is published, depend on a git checkout or a local path (see [Link a host app to local sources](#link-a-host-app-to-local-sources)).

Published installs resolve the compiled `dist/` build (`open-pages.js`, `open-pages.css`, and TypeScript declarations). The in-repo demo aliases to package **sources** for HMR (`pnpm demo`). Linked host apps resolve `dist/` — keep a watch build running (see below).

### Minimal editor

Styles are injected into a Shadow DOM by the package — **do not** import `@openpages/vue/style.css` in the host (that would leak package CSS into the page).

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

Your Vite (or equivalent) config must compile Vue SFCs from the package. A typical Vite host already has `@vitejs/plugin-vue`.

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

Opens at [http://localhost:5180](http://localhost:5180).

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
pnpm demo          # playground (sources + HMR) → http://localhost:5180
pnpm dev           # library watch rebuild → packages/open-pages/dist
pnpm test          # Vitest (@openpages/vue)
pnpm typecheck     # vue-tsc for library + demo
pnpm lint          # Biome
pnpm build         # one-shot library build
pnpm gatekeeper    # lint + typecheck + test (full local gate)
```

Package-scoped scripts also work from `packages/open-pages` (`pnpm test`, `pnpm test:watch`, `pnpm dev`, …).

### Link a host app to local OpenPages

`@openpages/vue` publishes **`dist/`** (see `exports` in `packages/open-pages/package.json`). A `link:` / `file:` dependency therefore loads the built bundle, not the `.vue` sources — edits under `src/` appear in the host only after a rebuild.

#### Option A — pnpm `link:` + library watch (recommended)

In the **host** app `package.json`:

```json
{
  "dependencies": {
    "@openpages/vue": "link:../OpenPages/packages/open-pages"
  }
}
```

Adjust the relative path to wherever you cloned OpenPages. Then use **two terminals**:

```bash
# terminal 1 — OpenPages monorepo (rebuilds dist on every change)
cd ../OpenPages
pnpm install
pnpm dev

# terminal 2 — host app
cd ../YourHostApp
pnpm install
pnpm dev
```

`pnpm dev` in OpenPages runs `vite build --watch` for `@openpages/vue`. Leave it running while you edit `packages/open-pages/src`; the host Vite server should pick up the updated `dist/` files (hard-refresh the host if needed).

Also install peers in the host if they are not already present: `vue` and `@lucide/vue`.

#### Option B — Vite alias to sources (no watch build)

Keep a normal dependency entry (or omit it) and force resolution in the **host** `vite.config.ts` to the package **`src/`** directory. Then host HMR compiles OpenPages SFCs directly — no `pnpm dev` watch in the OpenPages repo:

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
      // Point at the package `src/` directory (not `index.ts` / not `dist`).
      '@openpages/vue': path.join(openPagesRoot, 'src'),
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

#### Vue checklist for linked hosts

1. **Single Vue instance** — use `resolve.dedupe: ['vue']` (and avoid nested `node_modules/vue` inside the linked package when possible). Duplicate Vue causes “invalid vnode” / broken reactivity.
2. **Compile SFCs** — required for Option B (`@vitejs/plugin-vue`). Option A serves prebuilt JS from `dist/`.
3. **Styles** — do not import `@openpages/vue/style.css` in the host; OpenPages injects CSS into its Shadow DOM. Optional host CSS: `shadowStyles` prop.
4. **Two terminals (Option A)** — OpenPages `pnpm dev` (watch → `dist`) + host `pnpm dev`. Option B needs only the host `dev` server.

When you are ready to ship the host against a fixed OpenPages revision, switch the dependency back to a published version, a git tag, or a path commit — and remove the alias / `link:` override.

## License

**MIT**. See [LICENSE](./LICENSE).
