import type { Page } from './document'

export type PanelBox = {
  x: number
  y: number
  width: number
  height: number
}

export type ViewportSize = {
  width: number
  height: number
}

export type PanelFocusTransform = {
  scale: number
  translateX: number
  translateY: number
  transform: string
  transformOrigin: string
}

/** While focused, only the focused panel may be selected. */
export function canSelectWhileFocused(focusPanelId: string | null, sectionId: string): boolean {
  return focusPanelId === null || focusPanelId === sectionId
}

/** Convert a page-space point into coordinates local to the panel origin. */
export function pagePointToPanelLocal(
  pageX: number,
  pageY: number,
  panel: PanelBox,
): { x: number; y: number } {
  return { x: pageX - panel.x, y: pageY - panel.y }
}

/**
 * CSS transform that scales the page so `panel` fills the viewport (letterboxed),
 * aspect locked to the panel.
 */
export function canvasTransformForPanelFocus(
  _page: Pick<Page, 'width' | 'height'>,
  panel: PanelBox,
  viewport: ViewportSize,
  padding = 24,
): PanelFocusTransform {
  const availW = Math.max(1, viewport.width - padding * 2)
  const availH = Math.max(1, viewport.height - padding * 2)
  const scale = Math.min(availW / Math.max(1, panel.width), availH / Math.max(1, panel.height))
  const panelCenterX = panel.x + panel.width / 2
  const panelCenterY = panel.y + panel.height / 2
  const viewCenterX = viewport.width / 2
  const viewCenterY = viewport.height / 2
  // translate then scale around page origin: move panel center to view center after scale
  const translateX = viewCenterX / scale - panelCenterX
  const translateY = viewCenterY / scale - panelCenterY
  return {
    scale,
    translateX,
    translateY,
    transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
    transformOrigin: '0 0',
  }
}
