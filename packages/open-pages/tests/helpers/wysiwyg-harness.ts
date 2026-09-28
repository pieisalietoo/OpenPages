import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import OpenPagesRenderer from '../../src/components/OpenPagesRenderer.vue'
import type { OpenPagesDocument } from '../../src/model/document'
import { createCanvasMeasurer } from '../../src/model/text-layout/measure'

export type MountedEdit = {
  doc: OpenPagesDocument
  pageId: string
  sectionId: string
  wrapper: VueWrapper
}

export function stubLayoutRects(wrapper: VueWrapper, sectionId: string) {
  const section = wrapper.get(`[data-op-section="${sectionId}"]`)
  const sectionEl = section.element as HTMLElement
  const sw = Number.parseFloat(sectionEl.style.width) || 900
  const sh = Number.parseFloat(sectionEl.style.height) || 1200
  sectionEl.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: sw,
      bottom: sh,
      width: sw,
      height: sh,
      toJSON() {
        return {}
      },
    }) as DOMRect
  for (const line of section.findAll('[data-op-line]')) {
    const el = line.element as HTMLElement
    const left = Number.parseFloat(el.style.left) || 0
    const top = Number.parseFloat(el.style.top) || 0
    const width = Number.parseFloat(el.style.width) || 100
    const height = Number.parseFloat(el.style.height) || 20
    el.getBoundingClientRect = () =>
      ({
        x: left,
        y: top,
        left,
        top,
        right: left + width,
        bottom: top + height,
        width,
        height,
        toJSON() {
          return {}
        },
      }) as DOMRect
  }
}

export async function mountEditing(
  doc: OpenPagesDocument,
  pageId: string,
  sectionId: string,
): Promise<MountedEdit> {
  const wrapper = mount(OpenPagesRenderer, {
    props: { document: doc, pageId, selectedSectionIds: [sectionId] },
    attachTo: document.body,
  })
  await wrapper.get(`[data-op-section="${sectionId}"]`).trigger('dblclick')
  await nextTick()
  stubLayoutRects(wrapper, sectionId)
  return { doc, pageId, sectionId, wrapper }
}

export function lineByNeedle(mounted: MountedEdit, needle: string) {
  const root = mounted.wrapper.get(`[data-op-section="${mounted.sectionId}"]`)
  const hit = root.findAll('[data-op-line]').find((l) => l.text().includes(needle))
  if (!hit) throw new Error(`no line containing ${JSON.stringify(needle)}`)
  return hit
}

/**
 * List markers use padding-left in em (CSS ::before). Clicks must target the
 * visual glyph box (gutter + text measure), matching what a user sees.
 */
export function listGutterPx(el: HTMLElement): number {
  const pad = el.style.paddingLeft || ''
  const fs = Number.parseFloat(el.style.fontSize) || 14
  if (pad.endsWith('em')) {
    const em = Number.parseFloat(pad)
    return Number.isFinite(em) ? em * fs : 0
  }
  const px = Number.parseFloat(pad)
  return Number.isFinite(px) && px > 0 ? px : 0
}

/**
 * Client point over the glyph at `word[into]` (into=0 = first glyph start).
 * Includes the list-marker gutter so coordinates match painted text.
 */
export function pointIntoWord(el: HTMLElement, word: string, into = 1) {
  const text = el.textContent ?? ''
  const at = text.indexOf(word)
  if (at < 0) throw new Error(`word ${JSON.stringify(word)} not in ${JSON.stringify(text)}`)
  const intoClamped = Math.max(0, into)
  // Measure up to the caret slot: before glyph `into` within the word.
  const end = Math.min(text.length, at + intoClamped)
  const fontSize = Number.parseFloat(el.style.fontSize) || 14
  const fontFamily = el.style.fontFamily || 'Georgia, serif'
  const fontBold = el.style.fontWeight === '700' || el.style.fontWeight === 'bold'
  const measure = createCanvasMeasurer()
  const prefixW = measure(text.slice(0, end), { fontFamily, fontSize, fontBold })
  const gutter = listGutterPx(el)
  const rect = el.getBoundingClientRect()
  // Nudge 0.5px into the glyph so hit-test does not sit on the previous boundary.
  const x = gutter + prefixW + 0.5
  return {
    clientX: rect.left + Math.min(Math.max(1, x), Math.max(1, rect.width - 1)),
    clientY: rect.top + Math.min(4, rect.height / 2),
    pointerId: 1,
  }
}

export async function press(
  edit: ReturnType<VueWrapper['get']>,
  at: { clientX: number; clientY: number; pointerId?: number },
) {
  await edit.trigger('pointerdown', { button: 0, detail: 1, pointerId: 1, ...at })
  await edit.trigger('pointerup', { button: 0, pointerId: at.pointerId ?? 1 })
  await nextTick()
}

export async function copyPlain(edit: ReturnType<VueWrapper['get']>): Promise<string> {
  let written = ''
  await edit.trigger('copy', {
    clipboardData: {
      setData(type: string, data: string) {
        if (type === 'text/plain') written = data
      },
    },
  })
  return written
}

export async function selectWordAt(
  mounted: MountedEdit,
  needle: string,
  word: string,
): Promise<string> {
  const line = lineByNeedle(mounted, needle)
  const el = line.element as HTMLElement
  const edit = mounted.wrapper.get('[data-op-text-edit]')
  const at = pointIntoWord(el, word, 1)
  await press(edit, at)
  await press(edit, at)
  return copyPlain(edit)
}

export async function selectLineAt(
  mounted: MountedEdit,
  needle: string,
  word: string,
): Promise<string> {
  const line = lineByNeedle(mounted, needle)
  const el = line.element as HTMLElement
  const edit = mounted.wrapper.get('[data-op-text-edit]')
  const at = pointIntoWord(el, word, 1)
  await press(edit, at)
  await press(edit, at)
  await press(edit, at)
  return copyPlain(edit)
}

export function clickIntoForWord(word: string): number {
  return Math.min(2, Math.max(1, word.length - 1))
}

/** Expected plain substring after clickType inserts `key` into `word`. */
export function expectedInsertSlot(word: string, key: string): string {
  const into = clickIntoForWord(word)
  return word.slice(0, into) + key + word.slice(into)
}

export async function clickType(
  mounted: MountedEdit,
  needle: string,
  word: string,
  key: string,
): Promise<void> {
  const line = lineByNeedle(mounted, needle)
  const el = line.element as HTMLElement
  const edit = mounted.wrapper.get('[data-op-text-edit]')
  // Prefer interior of the word (not EOL) so affinity does not jump lines.
  const at = pointIntoWord(el, word, clickIntoForWord(word))
  await edit.trigger('pointerdown', { button: 0, ...at })
  await nextTick()
  await edit.trigger('keydown', { key })
  await nextTick()
}
