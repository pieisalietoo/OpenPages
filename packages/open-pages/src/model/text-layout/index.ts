export {
  type CaretAffinity,
  type CaretRect,
  caretRectForOffset,
  plainLengthFromLines,
} from './caret'
export {
  type ClientHit,
  caretLeftInLineEl,
  type DomHitFallback,
  hitTestClientPoint,
  offsetAtClientPoint,
} from './dom-hit'
export {
  type FitTextFrameInput,
  type FitTextFrameResult,
  fitTextFrame,
  type TextFitMode,
} from './fit'
export {
  columnRects,
  freeSegmentsForBand,
  iterLineSlots,
  type LineSlot,
  type Segment,
} from './geometry'
export {
  lineIndexForOffset,
  lineRangeAtOffset,
  moveCaretVertically,
  offsetAtPoint,
  snapCaretAfterEdit,
} from './hit-test'
export { htmlToPlainText } from './html-text'
export {
  type InlineRun,
  type InlineRunStyle,
  inlineRunsFromHtml,
  sliceInlineRuns,
} from './inline-runs'
export {
  type LaidOutLine,
  type LayoutTextFrameInput,
  type LayoutTextFrameResult,
  layoutTextFrame,
} from './layout'
export {
  createCanvasMeasurer,
  createFixedMeasurer,
  type MeasureFn,
  measurePlainPrefix,
  type TextMeasureStyle,
} from './measure'
export {
  type SelectionRect,
  selectionRects,
} from './selection'
