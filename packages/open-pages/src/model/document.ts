import {
  createDefaultPageGeometry,
  DEFAULT_MARGINS,
  type Guide,
  type PageMargins,
  type PageOrientation,
  type PagePresetId,
} from './page'
import { parseSection, type Section } from './section'

export const CURRENT_SCHEMA_VERSION = 1 as const

export type SchemaVersion = typeof CURRENT_SCHEMA_VERSION

export interface DocumentMeta {
  title: string
  createdAt: string
  updatedAt: string
}

export interface Page {
  id: string
  name: string
  width: number
  height: number
  margins: PageMargins
  guides: Guide[]
  orientation: PageOrientation
  preset: PagePresetId
  sections: Section[]
}

export interface Asset {
  id: string
  kind: string
  src: string
}

export interface OpenPagesDocument {
  schemaVersion: SchemaVersion
  meta: DocumentMeta
  pages: Page[]
  assets: Asset[]
  /** Host-bindable string variables referenced as {{key}} in section fields. */
  data: Record<string, string>
}

export interface CreateDocumentOptions {
  title: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}

export function createDocument(options: CreateDocumentOptions): OpenPagesDocument {
  const stamp = nowIso()
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    meta: {
      title: options.title,
      createdAt: stamp,
      updatedAt: stamp,
    },
    pages: [
      {
        id: newId('page'),
        name: 'Page 1',
        ...createDefaultPageGeometry('a4'),
        sections: [],
      },
    ],
    assets: [],
    data: {},
  }
}

export function serializeDocument(doc: OpenPagesDocument): string {
  return JSON.stringify(doc)
}

export function migrateDocument(doc: OpenPagesDocument): OpenPagesDocument {
  return doc
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireString(record: Record<string, unknown>, key: string, path: string): string {
  const value = record[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${path}.${key} must be a non-empty string`)
  }
  return value
}

function requireNumber(record: Record<string, unknown>, key: string, path: string): number {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${path}.${key} must be a finite number`)
  }
  return value
}

function parsePage(value: unknown, index: number): Page {
  const path = `pages[${index}]`
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object`)
  }
  if (typeof value.id !== 'string' || value.id.length === 0) {
    throw new Error(`${path}.id must be a non-empty string`)
  }
  return {
    id: value.id,
    name: requireString(value, 'name', path),
    width: requireNumber(value, 'width', path),
    height: requireNumber(value, 'height', path),
    margins: parseMargins(value.margins, path),
    guides: parseGuides(value.guides, path),
    orientation: parseOrientation(value.orientation),
    preset: parsePreset(value.preset),
    sections: Array.isArray(value.sections) ? value.sections.map(parseSection) : [],
  }
}

function parseMargins(value: unknown, path: string): PageMargins {
  if (!isRecord(value)) {
    return { ...DEFAULT_MARGINS }
  }
  return {
    top: requireNumber(value, 'top', `${path}.margins`),
    right: requireNumber(value, 'right', `${path}.margins`),
    bottom: requireNumber(value, 'bottom', `${path}.margins`),
    left: requireNumber(value, 'left', `${path}.margins`),
  }
}

function parseGuides(value: unknown, path: string): Guide[] {
  if (value === undefined) {
    return []
  }
  if (!Array.isArray(value)) {
    throw new Error(`${path}.guides must be an array`)
  }
  return value.map((guide, index) => {
    if (!isRecord(guide)) {
      throw new Error(`${path}.guides[${index}] must be an object`)
    }
    const orientation = guide.orientation
    if (orientation !== 'horizontal' && orientation !== 'vertical') {
      throw new Error(`${path}.guides[${index}].orientation must be horizontal or vertical`)
    }
    return {
      id: requireString(guide, 'id', `${path}.guides[${index}]`),
      orientation,
      offset: requireNumber(guide, 'offset', `${path}.guides[${index}]`),
    }
  })
}

function parseOrientation(value: unknown): PageOrientation {
  return value === 'landscape' ? 'landscape' : 'portrait'
}

function parsePreset(value: unknown): PagePresetId {
  if (value === 'letter' || value === 'tabloid' || value === 'custom' || value === 'a4') {
    return value
  }
  return 'custom'
}

function parseAsset(value: unknown, index: number): Asset {
  const path = `assets[${index}]`
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object`)
  }
  return {
    id: requireString(value, 'id', path),
    kind: requireString(value, 'kind', path),
    src: requireString(value, 'src', path),
  }
}

export function parseDocument(json: string): OpenPagesDocument {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new Error('Invalid JSON')
  }

  if (!isRecord(raw)) {
    throw new Error('Document must be an object')
  }

  if (!('schemaVersion' in raw)) {
    throw new Error('schemaVersion is required')
  }

  if (raw.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(`Unsupported schemaVersion: ${String(raw.schemaVersion)}`)
  }

  if (!isRecord(raw.meta)) {
    throw new Error('meta must be an object')
  }

  if (!Array.isArray(raw.pages)) {
    throw new Error('pages must be an array')
  }

  if (!Array.isArray(raw.assets)) {
    throw new Error('assets must be an array')
  }

  const doc: OpenPagesDocument = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    meta: {
      title: requireString(raw.meta, 'title', 'meta'),
      createdAt: requireString(raw.meta, 'createdAt', 'meta'),
      updatedAt: requireString(raw.meta, 'updatedAt', 'meta'),
    },
    pages: raw.pages.map(parsePage),
    assets: raw.assets.map(parseAsset),
    data: parseData(raw.data),
  }

  return migrateDocument(doc)
}

function parseData(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {}
  }
  const data: Record<string, string> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') {
      data[key] = entry
    }
  }
  return data
}
