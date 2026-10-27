/**
 * Public barrel for the Polaroid rendering library.
 *
 * Everything exported here is framework-agnostic TypeScript.
 */

export {
  FILTERS,
  FILTER_BY_ID,
  canvasFilterFor,
  cssFilterFor,
  type FilterId,
  type FilterDef,
} from './filters';

export {
  drawSticker,
  drawStickers,
  stickerFontSize,
  createSticker,
  createStickerInstance,
  STICKER_FONT_STACK,
  STICKER_FONT_RATIO,
  STICKER_MIN_SCALE,
  STICKER_MAX_SCALE,
  STICKERS,
  STICKER_BY_ID,
  STICKERS_BY_CATEGORY,
  STICKER_CATEGORIES,
  type StickerItem,
  type StickerDef,
  type StickerCategory,
} from './stickers';

export {
  renderPaper,
  renderSingle,
  computeCoverRect,
  measurePaper,
  canvasToBlob,
  downloadCanvas,
  PAPER_STYLES,
  STYLE_BY_ID,
  DEFAULT_STYLE_ID,
  THEMES,
  LAYOUT_ASPECT,
  pickStyle,
  averageAspect,
  DEFAULT_SHEET_WIDTH,
  CAPTION_FONT_STACK,
  DATE_FONT_STACK,
  type PhotoFrame,
  type RenderOptions,
  type CoverRect,
  type PaperLayout,
  type PaperStyle,
  type PhotoSlot,
} from './polaroid';

export {
  SIMULATIONS,
  SIM_BY_ID,
  DEFAULT_SIM,
  getSim,
  simulationToCss,
  applySimulationToCanvas,
  simulationToCanvas,
  type SimId,
  type Simulation,
} from './fuji';
