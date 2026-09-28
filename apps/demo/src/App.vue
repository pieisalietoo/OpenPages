<script setup lang="ts">
import {
  createCustomFontsDemoDocument,
  createDataBoundDocument,
  createDocument,
  createFeatureDemoDocument,
  createFontCatalog,
  createFontsDemoDocument,
  createHtmlShowcaseDocument,
  createI18n,
  createLayoutLibrary,
  createNewspaperDemoDocument,
  DEMO_CUSTOM_FONTS,
  loadOpenPagesFonts,
  type OpenPagesDocument,
  OpenPagesEditor,
  serializeDocument,
} from '@openpages/vue'
import { LayoutTemplate } from 'lucide-vue-next'
import { computed, nextTick, reactive, ref, watch } from 'vue'

type DemoTab = 'layouts' | 'fonts' | 'custom' | 'language'

const activeTab = ref<DemoTab>('layouts')
const mountedTabs = reactive({
  layouts: true,
  fonts: false,
  custom: false,
  language: false,
})

watch(activeTab, (tab) => {
  mountedTabs[tab] = true
})

function selectTab(tab: DemoTab) {
  activeTab.value = tab
}

// Shared i18n for the Language tab editor (host-owned controller).
const demoI18n = createI18n({
  locale: 'en',
  messages: {
    en: { 'demo.banner': 'Language demo — toolbar labels follow the active locale.' },
    it: { 'demo.banner': 'Demo lingua — le etichette della toolbar seguono la lingua attiva.' },
  },
})

// --- Layout showcase tab ---
const blank = createDocument({ title: 'Blank' })
const newspaper = createNewspaperDemoDocument()
const feature = createFeatureDemoDocument()
const htmlShowcase = createHtmlShowcaseDocument()
const dataBound = createDataBoundDocument()

const layouts = createLayoutLibrary({
  layouts: [
    { name: 'HTML Showcase', document: htmlShowcase },
    { name: 'Newspaper', document: newspaper },
    { name: 'Blank', document: blank },
    { name: 'Feature Lab', document: feature },
    { name: 'Data Bound', document: dataBound },
  ],
  activeName: 'HTML Showcase',
})

const layoutDoc = ref<OpenPagesDocument>(layouts.getActive()?.document ?? htmlShowcase)
const activeLayoutName = ref(layouts.getActive()?.name ?? 'HTML Showcase')
const layoutJson = ref(serializeDocument(layoutDoc.value))
const jsonError = ref('')
const lastEvent = ref('')
const disabledPdf = ref(false)

const imageUrl = ref(dataBound.data.imageUrl ?? '')
const bodyText = ref(dataBound.data.bodyText ?? '')
const snippet = ref(dataBound.data.snippet ?? '')

const showDataFields = computed(() => activeLayoutName.value === 'Data Bound')

const toolEnabled = computed(() => ({
  'export.pdf': !disabledPdf.value,
}))

const layoutLede = computed(() => {
  switch (activeLayoutName.value) {
    case 'Data Bound':
      return 'Data-bound layout: sections use {{imageUrl}}, {{bodyText}}, and {{snippet}} from the model. Update the fields below to refresh the page.'
    case 'Blank':
      return 'Empty page: add sections from the toolbar, then export as PNG/PDF or layout JSON.'
    case 'Newspaper':
      return 'Broadsheet demo: full-width masthead, 4-column body, and two mid-page runarounds (text wraps around them). Add more runarounds from Add.'
    case 'HTML Showcase':
      return 'HTML element showcase in the layout engine: h1–h6, paragraphs, blockquote, ul/ol. Double-click to edit; use </> for source.'
    case 'Feature Lab':
      return 'CTRL+click multi-select; magnet (toolbar) snaps to edges/margins/centers/gaps; hold SHIFT while dragging to disable it. Print/PNG/PDF export the sheet only. CTRL+arrows 1px, CTRL+SHIFT 10px.'
    default:
      return 'Pick a layout from the toolbar to explore OpenPages features.'
  }
})

const prettyJson = computed(() => {
  try {
    return JSON.stringify(JSON.parse(layoutJson.value), null, 2)
  } catch {
    return layoutJson.value
  }
})

watch(layoutDoc, (value) => {
  layoutJson.value = serializeDocument(value)
  jsonError.value = ''
})

watch([imageUrl, bodyText, snippet], () => {
  if (!showDataFields.value) return
  layoutDoc.value.data = {
    imageUrl: imageUrl.value,
    bodyText: bodyText.value,
    snippet: snippet.value,
  }
  layoutJson.value = serializeDocument(layoutDoc.value)
})

function syncDataFieldsFromDoc() {
  imageUrl.value = layoutDoc.value.data.imageUrl ?? ''
  bodyText.value = layoutDoc.value.data.bodyText ?? ''
  snippet.value = layoutDoc.value.data.snippet ?? ''
}

function onUpdateJson(value: string) {
  layoutJson.value = value
  jsonError.value = ''
}

function applyJsonFromTextarea() {
  try {
    JSON.parse(layoutJson.value)
    jsonError.value = ''
  } catch {
    jsonError.value = 'Invalid JSON'
  }
}

function onToolActivate(event: { id: string }) {
  lastEvent.value = `toolActivate:${event.id}`
}

function onLayoutChange(event: { name: string | null }) {
  activeLayoutName.value = event.name ?? ''
  lastEvent.value = `layoutChange:${event.name ?? ''}`
  if (event.name === 'Data Bound') {
    void nextTick(() => syncDataFieldsFromDoc())
  }
}

function onExport(event: { format: string }) {
  lastEvent.value = `export:${event.format}`
}

function onSelectionChange(ids: string[]) {
  lastEvent.value = `selection:${ids.length}`
}

function togglePdf() {
  disabledPdf.value = !disabledPdf.value
}

// --- Fonts tab ---
const fontsCatalog = createFontCatalog()
const fontsDoc = ref(createFontsDemoDocument())
const fontsJson = ref(serializeDocument(fontsDoc.value))

watch(fontsDoc, (value) => {
  fontsJson.value = serializeDocument(value)
})

// --- Custom fonts tab ---
const customCatalog = createFontCatalog({ fonts: DEMO_CUSTOM_FONTS })
const customDoc = ref(createCustomFontsDemoDocument())
const customJson = ref(serializeDocument(customDoc.value))
const customFontsReady = ref(false)
const customFontsError = ref('')

watch(customDoc, (value) => {
  customJson.value = serializeDocument(value)
})

watch(
  () => mountedTabs.custom,
  async (mounted) => {
    if (!mounted || customFontsReady.value) return
    try {
      await loadOpenPagesFonts(DEMO_CUSTOM_FONTS)
      customFontsReady.value = true
      customFontsError.value = ''
    } catch (err) {
      customFontsError.value = err instanceof Error ? err.message : String(err)
    }
  },
)

// --- Language tab ---
const languageDoc = ref(createHtmlShowcaseDocument())
const languageJson = ref(serializeDocument(languageDoc.value))

watch(languageDoc, (value) => {
  languageJson.value = serializeDocument(value)
})

function setDemoLocale(locale: 'en' | 'it') {
  demoI18n.setLocale(locale)
}
</script>

<template>
  <main class="demo-shell">
    <header class="demo-header">
      <LayoutTemplate class="demo-icon" aria-hidden="true" />
      <div>
        <h1>OpenPages</h1>
        <p class="demo-lede">
          Tabbed demo: layout showcase, built-in fonts, custom fonts loaded at runtime, and i18n.
          Each tab mounts its own <code>OpenPagesEditor</code> on first visit.
        </p>
      </div>
    </header>

    <div class="demo-tabs" role="tablist" aria-label="Demo sections">
      <button
        type="button"
        role="tab"
        class="demo-tab"
        data-demo-tab="layouts"
        :aria-selected="activeTab === 'layouts'"
        :class="{ 'is-active': activeTab === 'layouts' }"
        @click="selectTab('layouts')"
      >
        Layout showcase
      </button>
      <button
        type="button"
        role="tab"
        class="demo-tab"
        data-demo-tab="fonts"
        :aria-selected="activeTab === 'fonts'"
        :class="{ 'is-active': activeTab === 'fonts' }"
        @click="selectTab('fonts')"
      >
        Fonts
      </button>
      <button
        type="button"
        role="tab"
        class="demo-tab"
        data-demo-tab="custom"
        :aria-selected="activeTab === 'custom'"
        :class="{ 'is-active': activeTab === 'custom' }"
        @click="selectTab('custom')"
      >
        Custom fonts
      </button>
      <button
        type="button"
        role="tab"
        class="demo-tab"
        data-demo-tab="language"
        :aria-selected="activeTab === 'language'"
        :class="{ 'is-active': activeTab === 'language' }"
        @click="selectTab('language')"
      >
        Language
      </button>
    </div>

    <!-- Layout showcase -->
    <section
      v-if="mountedTabs.layouts"
      v-show="activeTab === 'layouts'"
      class="demo-tab-panel"
      role="tabpanel"
      data-demo-panel="layouts"
    >
      <p class="demo-panel-lede">{{ layoutLede }}</p>

      <div v-if="showDataFields" class="demo-data-fields" aria-label="Model variables">
        <label class="demo-field">
          <span>imageUrl</span>
          <input v-model="imageUrl" type="text" />
        </label>
        <label class="demo-field">
          <span>bodyText</span>
          <input v-model="bodyText" type="text" />
        </label>
        <label class="demo-field">
          <span>snippet</span>
          <input v-model="snippet" type="text" />
        </label>
      </div>

      <div class="demo-host-controls">
        <button type="button" class="demo-btn" @click="togglePdf">
          {{ disabledPdf ? 'Enable PDF tool' : 'Disable PDF tool' }}
        </button>
        <p v-if="lastEvent" class="demo-event">Last event: {{ lastEvent }}</p>
      </div>

      <OpenPagesEditor
        v-model="layoutDoc"
        v-model:json="layoutJson"
        :layout-library="layouts"
        :tool-enabled="toolEnabled"
        @tool-activate="onToolActivate"
        @layout-change="onLayoutChange"
        @export="onExport"
        @selection-change="onSelectionChange"
      />

      <section class="demo-json-panel" aria-label="Layout JSON">
        <h2>Layout JSON</h2>
        <p class="demo-json-hint">
          External bind on <code>v-model:json</code>. Pretty view (read-only) and editable raw
          textarea.
        </p>
        <pre class="demo-json-pretty">{{ prettyJson }}</pre>
        <label class="demo-json-label" for="demo-json-raw">Raw JSON (editable)</label>
        <textarea
          id="demo-json-raw"
          class="demo-json-raw"
          :value="layoutJson"
          rows="14"
          @input="onUpdateJson(($event.target as HTMLTextAreaElement).value)"
          @change="applyJsonFromTextarea"
        />
        <p v-if="jsonError" class="demo-json-error">{{ jsonError }}</p>
      </section>
    </section>

    <!-- Fonts -->
    <section
      v-if="mountedTabs.fonts"
      v-show="activeTab === 'fonts'"
      class="demo-tab-panel"
      role="tabpanel"
      data-demo-panel="fonts"
    >
      <aside class="demo-instructions" aria-label="Built-in font instructions">
        <h2>How to offer more built-in fonts</h2>
        <ol>
          <li>
            Import <code>createFontCatalog</code> / <code>BUILTIN_FONTS</code> from
            <code>@openpages/vue</code>.
          </li>
          <li>
            Pass the catalog to the <code>fonts</code> prop on <code>OpenPagesEditor</code> (or
            <code>OpenPagesRenderer</code>). By default the editor already uses
            <code>BUILTIN_FONTS</code> (Georgia, Times, Arial, Verdana, Courier, …).
          </li>
          <li>
            Optional: <code>createFontCatalog({ fonts: extras })</code> appends host fonts without
            replacing builtins; use <code>includeBuiltins: false</code> for a host-only list.
          </li>
          <li>
            Set <code>section.fontFamily</code> to the catalog entry’s <code>family</code> stack (the
            same CSS value used in the chrome &lt;option&gt; list). Prefer selecting by catalog
            <code>id</code> when bold/regular faces share a family.
          </li>
        </ol>
        <pre class="demo-code">import { createFontCatalog, OpenPagesEditor } from '@openpages/vue'

const fonts = createFontCatalog()

&lt;OpenPagesEditor v-model="doc" :fonts="fonts" /&gt;</pre>
      </aside>

      <OpenPagesEditor v-model="fontsDoc" v-model:json="fontsJson" :fonts="fontsCatalog" />
    </section>

    <!-- Custom fonts -->
    <section
      v-if="mountedTabs.custom"
      v-show="activeTab === 'custom'"
      class="demo-tab-panel"
      role="tabpanel"
      data-demo-panel="custom"
    >
      <aside class="demo-instructions" aria-label="Custom font instructions">
        <h2>How to load additional fonts</h2>
        <ol>
          <li>
            Define <code>OpenPagesFont</code> entries with <code>family</code> (CSS stack),
            <code>faceName</code> (FontFace name), <code>source</code> (woff2/ttf URL), and
            optional <code>weight</code> (use 700 for a Bold catalog row).
          </li>
          <li>
            Before showing the editor call
            <code>await loadOpenPagesFonts(customFonts)</code> (browser <code>FontFace</code> API).
          </li>
          <li>
            Merge with builtins via <code>createFontCatalog({ fonts: customFonts })</code> and pass
            the result to <code>:fonts</code>.
          </li>
          <li>
            Assign sections the same <code>family</code>. Selecting a weight-700 catalog id sets
            <code>fontBold</code> so the Bold face stays selected in the menu.
          </li>
        </ol>
        <pre class="demo-code">import {
  createFontCatalog,
  loadOpenPagesFonts,
  OpenPagesEditor,
} from '@openpages/vue'

const custom = [{
  id: 'literata-bold',
  label: 'Literata Bold',
  family: "'Literata', Georgia, serif",
  faceName: 'Literata',
  source: 'https://…/literata-700.woff2',
  weight: 700,
}]

await loadOpenPagesFonts(custom)
const fonts = createFontCatalog({ fonts: custom })

&lt;OpenPagesEditor v-model="doc" :fonts="fonts" /&gt;</pre>
        <p v-if="customFontsError" class="demo-json-error">
          Font load failed: {{ customFontsError }}
        </p>
        <p v-else-if="!customFontsReady" class="demo-event">Loading Literata…</p>
        <p v-else class="demo-event">Literata loaded via FontFace.</p>
      </aside>

      <OpenPagesEditor
        v-if="customFontsReady"
        v-model="customDoc"
        v-model:json="customJson"
        :fonts="customCatalog"
      />
    </section>

    <!-- Language -->
    <section
      v-if="mountedTabs.language"
      v-show="activeTab === 'language'"
      class="demo-tab-panel"
      role="tabpanel"
      data-demo-panel="language"
    >
      <aside class="demo-instructions" aria-label="i18n instructions">
        <h2>How to configure language</h2>
        <ol>
          <li>
            Create a controller with <code>createI18n({ locale: 'en' })</code> (English is the
            default). Pass <code>locale: 'it'</code> to start in Italian.
          </li>
          <li>
            Hand the same instance to <code>&lt;OpenPagesEditor :i18n="i18n" /&gt;</code> (or use
            the <code>locale</code> prop when you do not need a shared controller).
          </li>
          <li>
            Call <code>i18n.setLocale('it')</code> / <code>'en'</code> from host UI (buttons below)
            to switch at runtime — toolbar and chrome labels update reactively.
          </li>
          <li>
            Add or override strings via
            <code>createI18n({ messages: { en: {…}, it: {…} } })</code> or
            <code>i18n.extend({ en: { 'host.key': '…' } })</code>. Missing keys fall back to
            English.
          </li>
        </ol>
        <pre class="demo-code">import { createI18n, OpenPagesEditor } from '@openpages/vue'

const i18n = createI18n({
  locale: 'en',
  messages: {
    en: { 'host.tip': 'Hello' },
    it: { 'host.tip': 'Ciao' },
  },
})

i18n.setLocale('it')

&lt;OpenPagesEditor v-model="doc" :i18n="i18n" /&gt;</pre>
      </aside>

      <div class="demo-host-controls" aria-label="Locale switcher">
        <button
          type="button"
          class="demo-btn"
          data-demo-locale="en"
          :class="{ 'is-active': demoI18n.locale.value === 'en' }"
          @click="setDemoLocale('en')"
        >
          English
        </button>
        <button
          type="button"
          class="demo-btn"
          data-demo-locale="it"
          :class="{ 'is-active': demoI18n.locale.value === 'it' }"
          @click="setDemoLocale('it')"
        >
          Italiano
        </button>
        <p class="demo-event">
          {{ demoI18n.t('demo.banner') }} (locale: {{ demoI18n.locale.value }})
        </p>
      </div>

      <OpenPagesEditor
        v-model="languageDoc"
        v-model:json="languageJson"
        :i18n="demoI18n"
      />
    </section>
  </main>
</template>
