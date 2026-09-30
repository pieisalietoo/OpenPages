export type { DataBoundDefaults, DocumentData } from './bindings'
export { createDataBoundDocument, resolveTemplate } from './bindings'
export { createCustomFontsDemoDocument, DEMO_CUSTOM_FONTS } from './custom-fonts-demo'
export type {
  Asset,
  CreateDocumentOptions,
  DocumentMeta,
  OpenPagesDocument,
  Page,
  SchemaVersion,
} from './document'
export {
  CURRENT_SCHEMA_VERSION,
  createDocument,
  migrateDocument,
  parseDocument,
  serializeDocument,
} from './document'
export { createFeatureDemoDocument } from './feature-demo'
export type {
  CreateFontCatalogOptions,
  FontCatalog,
  FontsChangeEvent,
  OpenPagesFont,
} from './fonts'
export {
  applyCatalogFontSelection,
  BUILTIN_FONTS,
  createFontCatalog,
  faceNameForFont,
  fontWeightIsBold,
  loadOpenPagesFonts,
  matchCatalogFont,
  missingFontFamilies,
  slugFontId,
} from './fonts'
export { createFontsDemoDocument } from './fonts-demo'
export type { HistoryController } from './history'
export { createHistory } from './history'
export { createHtmlShowcaseDocument } from './html-showcase-demo'
export type {
  CreateLayoutLibraryOptions,
  LayoutChangeEvent,
  LayoutLibrary,
  NamedLayout,
} from './layouts'
export { createLayoutLibrary } from './layouts'
export { createNewspaperDemoDocument } from './newspaper-demo'
export type {
  Guide,
  PageMargins,
  PageOrientation,
  PagePresetId,
  PageSizePreset,
} from './page'
export {
  applyPagePreset,
  createDefaultPageGeometry,
  DEFAULT_MARGINS,
  PAGE_PRESETS,
  setPageMargins,
} from './page'
export type {
  Rect as RunaroundRect,
  RelativeExclusion,
  RunaroundZoneRect,
} from './runaround'
export {
  DEFAULT_WRAP_OFFSET,
  inflateRect,
  intersectRects,
  relativeExclusionsForHost,
} from './runaround'
export { sanitizeTextHtml } from './sanitize-html'
export type {
  AddHeadlineSectionInput,
  AddImageSectionInput,
  AddPanelSectionInput,
  AddRunaroundSectionInput,
  AddTextSectionInput,
  HeadlineSection,
  ImageFit,
  ImageSection,
  NudgeKey,
  PanelBorderStyle,
  PanelSection,
  RunaroundSection,
  Section,
  SectionBase,
  SectionType,
  TextSection,
} from './section'
export {
  addHeadlineSection,
  addImageSection,
  addPanelSection,
  addRunaroundSection,
  addTextSection,
  bringForward,
  bringToFront,
  bumpFontSizes,
  bumpTextSectionFonts,
  deleteSection,
  duplicateSection,
  groupSections,
  moveSection,
  nudgeSection,
  parseSection,
  reorderSection,
  resizeSection,
  sendBackward,
  sendToBack,
  setSectionHidden,
  setSectionLocked,
  ungroupSections,
  updateSectionStyle,
  updateTextStyle,
} from './section'
export type { SelectionState } from './selection'
export {
  clearSelection,
  createSelection,
  hoverSection,
  isSelected,
  selectSection,
  toggleSectionSelection,
} from './selection'
export type {
  SnapAlignGuide,
  SnapGapGuide,
  SnapGuide,
  SnapOptions,
  SnapPage,
  SnapRect,
  SnapResult,
} from './snap'
export { DEFAULT_SNAP_THRESHOLD, snapSectionPosition } from './snap'
export {
  deletePlainRange,
  insertPlainText,
  plainTextLength,
  plainTextOf,
  setDomSelectionFromPlainOffsets,
  wordRangeAtOffset,
} from './text-edit/plain-offset'
export {
  applyInlineStyleToPlainRange,
  bumpFontSizeInPlainRange,
  plainOffsetFromDom,
  wrapPlainRangeWithCommand,
} from './text-edit/plain-style'
export type { InlineTextStyle } from './text-inline'
export {
  applyInlineStyleToElement,
  applyInlineStyleToRange,
  applyInlineStyleToSelection,
  bumpFontSizesInSelection,
  getEditableSelectionRange,
} from './text-inline'
export type {
  CaretAffinity,
  CaretRect,
  ClientHit,
  FitTextFrameResult,
  InlineRun,
  InlineRunStyle,
  LaidOutLine,
  SelectionRect,
  TextFitMode,
} from './text-layout'
export {
  caretLeftInLineEl,
  caretRectForOffset,
  columnRects,
  createCanvasMeasurer,
  createFixedMeasurer,
  fitTextFrame,
  freeSegmentsForBand,
  hitTestClientPoint,
  htmlToPlainText,
  inlineRunsFromHtml,
  iterLineSlots,
  layoutTextFrame,
  lineIndexForOffset,
  lineRangeAtOffset,
  moveCaretVertically,
  offsetAtClientPoint,
  offsetAtPoint,
  plainLengthFromLines,
  selectionRects,
  sliceInlineRuns,
} from './text-layout'
