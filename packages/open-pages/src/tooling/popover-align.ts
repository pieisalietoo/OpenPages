/** Default min width for `.op-tool-popover` (12rem @ 16px). */
export const POPOVER_MIN_WIDTH_PX = 192

/** True when a left-anchored popover would extend past the container's right edge. */
export function shouldAlignPopoverEnd(options: {
  anchorLeft: number
  containerRight: number
  minWidth?: number
}): boolean {
  const minWidth = options.minWidth ?? POPOVER_MIN_WIDTH_PX
  return options.anchorLeft + minWidth > options.containerRight
}
