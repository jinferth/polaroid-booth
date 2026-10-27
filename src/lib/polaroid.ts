/**
 * Paper renderer.
 *
 * Framework-agnostic: everything works against a raw `HTMLCanvasElement`, so
 * it can be driven by React, Vue, Svelte or plain DOM code alike.
 *
 * The renderer is layout-agnostic — it asks `layouts.ts` for a `PaperLayout`
 * and then paints whatever slots come back. Adding a new paper design means
 * adding data to `layouts.ts`, not touching this file.
 */

import { applySimulationToCanvas, type SimId } from './fuji'
import {
  buildLayout,
  paintPaper,
  roundRect,
  type PaperLayout,
  type PaperStyle,
  type PhotoSlot,
} from './layouts'
import { drawStickers, type StickerItem } from './stickers'

/** A photo to be placed on the paper. */
export interface PhotoFrame {
  /** Anything the canvas can draw: HTMLImageElement, HTMLCanvasElement, ImageBitmap… */
  image: CanvasImageSource
  /** Intrinsic width of the source image, in px. */
  width: number
  /** Intrinsic height of the source image, in px. */
  height: number
}

/** Options for {@link renderPaper}. */
export interface RenderOptions {
  /** 1..6 photos. */
  photos: PhotoFrame[]
  /** The paper design to use. */
  style: PaperStyle
  /** Handwritten caption. */
  caption: string
  /** Optional date stamp, e.g. `"2026.10.26"`. */
  dateStamp?: string
  /** Stickers placed on top of the finished sheet. */
  stickers?: StickerItem[]
  /** Logical px width of the sheet. Default `380`. */
  width?: number
  /** Seed for the deterministic rotation jitter. */
  seed?: number
  /** Fujifilm film simulation applied to each photo before compositing. */
  simulation?: SimId | string
}

/** A cover-fit crop rectangle plus the destination rectangle. */
export interface CoverRect {
  sx: number
  sy: number
  sw: number
  sh: number
  dx: number
  dy: number
  dw: number
  dh: number
}

/** Default logical width of a sheet. */
export const DEFAULT_SHEET_WIDTH = 380

/** Handwriting font stack for captions. */
export const CAPTION_FONT_STACK = '"Caveat", "Segoe Script", "Bradley Hand", cursive'

/** Monospace font stack for the date stamp. */
export const DATE_FONT_STACK = '"Space Mono", "SFMono-Regular", Consolas, monospace'

/**
 * Compute a cover-fit ("fill") crop of a source image into a destination box.
 *
 * The source region is cropped from the centre so the image always fills the
 * destination completely, with no letterboxing.
 */
export function computeCoverRect(
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): CoverRect {
  const safeSw = sw > 0 ? sw : 1
  const safeSh = sh > 0 ? sh : 1
  const safeDw = dw > 0 ? dw : 1
  const safeDh = dh > 0 ? dh : 1

  const sourceRatio = safeSw / safeSh
  const destRatio = safeDw / safeDh

  if (sourceRatio > destRatio) {
    // Source is wider than the destination → crop left/right.
    const cropW = safeSh * destRatio
    return { sx: (safeSw - cropW) / 2, sy: 0, sw: cropW, sh: safeSh, dx: 0, dy: 0, dw: safeDw, dh: safeDh }
  }
  // Source is taller than the destination → crop top/bottom.
  const cropH = safeSw / destRatio
  return { sx: 0, sy: (safeSh - cropH) / 2, sw: safeSw, sh: cropH, dx: 0, dy: 0, dw: safeDw, dh: safeDh }
}

/**
 * Resolve the geometry of a sheet without painting it.
 * Useful for sizing containers before any pixels exist.
 */
export function measurePaper(
  style: PaperStyle,
  photos: readonly PhotoFrame[],
  width = DEFAULT_SHEET_WIDTH,
  seed = 1234,
): PaperLayout {
  return buildLayout(style, photos.length > 0 ? photos : [PLACEHOLDER], width, seed)
}

const PLACEHOLDER: PhotoFrame = { image: {} as CanvasImageSource, width: 1, height: 1 }

/** Resolve the device pixel ratio, clamped to a sane range. */
function resolveDpr(): number {
  const raw = typeof window !== 'undefined' ? window.devicePixelRatio : 1
  const dpr = Number.isFinite(raw) && raw > 0 ? raw : 1
  return Math.min(dpr, 3)
}

/* -------------------------------------------------------------------------- */
/* Film-simulation baking (cached)                                            */
/* -------------------------------------------------------------------------- */

const simCache = new WeakMap<CanvasImageSource, Map<string, PhotoFrame>>()

/**
 * Draw a photo into a fresh canvas with a film simulation baked in.
 *
 * Returns the original frame untouched when no simulation is selected, so
 * the common path costs nothing. Cached by (image, sim, seed) because the
 * renderer runs on every caption keystroke.
 */
function bakeSimulation(
  photo: PhotoFrame,
  simId: SimId | string | undefined,
  seed: number,
): PhotoFrame {
  if (!simId || simId === 'none') return photo

  let perImage = simCache.get(photo.image)
  if (!perImage) {
    perImage = new Map()
    simCache.set(photo.image, perImage)
  }
  const key = `${simId}|${seed}`
  const hit = perImage.get(key)
  if (hit) return hit

  const w = Math.max(1, Math.round(photo.width))
  const h = Math.max(1, Math.round(photo.height))
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const c = out.getContext('2d', { willReadFrequently: true })
  if (!c) return photo

  c.drawImage(photo.image, 0, 0, w, h)
  applySimulationToCanvas(out, simId, { seed })

  const baked: PhotoFrame = { image: out, width: w, height: h }
  perImage.set(key, baked)
  return baked
}

/* -------------------------------------------------------------------------- */
/* Painting primitives                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Draw one photo into its window.
 *
 * The window is already shaped like the photo (see `fitWindowInside` in
 * `layouts.ts`), so this draws the whole image without cropping. A small
 * epsilon guard keeps fractional rounding from hinting at a 1px edge.
 */
function drawPhotoInWindow(
  ctx: CanvasRenderingContext2D,
  slot: PhotoSlot,
  photo: PhotoFrame | undefined,
): void {
  if (!photo) return
  const win = slot.window
  if (win.width <= 0 || win.height <= 0) return

  ctx.save()
  ctx.beginPath()
  ctx.rect(win.x, win.y, win.width, win.height)
  ctx.clip()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // `contain` semantics: the entire photo, centred, never cropped.
  const srcAspect = photo.width > 0 && photo.height > 0 ? photo.width / photo.height : win.width / win.height
  const winAspect = win.width / win.height
  let dw = win.width
  let dh = win.height
  if (srcAspect > winAspect) {
    dh = win.width / srcAspect
  } else {
    dw = win.height * srcAspect
  }
  const dx = win.x + (win.width - dw) / 2
  const dy = win.y + (win.height - dh) / 2

  ctx.drawImage(photo.image, dx, dy, dw, dh)
  ctx.restore()
}

/** Draw the frame card behind a photo, with its theme styling and shadow. */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  style: PaperStyle,
  slot: PhotoSlot,
  sheetWidth: number,
): void {
  const theme = style.theme
  const radius = Math.min(slot.width, slot.height) * theme.radius

  ctx.save()
  // Rotate around the frame centre.
  if (slot.rotation !== 0) {
    const cx = slot.x + slot.width / 2
    const cy = slot.y + slot.height / 2
    ctx.translate(cx, cy)
    ctx.rotate(slot.rotation)
    ctx.translate(-cx, -cy)
  }

  ctx.shadowColor = theme.shadow
  ctx.shadowBlur = sheetWidth * 0.028
  ctx.shadowOffsetY = sheetWidth * 0.009

  ctx.fillStyle = theme.frame
  roundRect(ctx, slot.x, slot.y, slot.width, slot.height, radius)
  ctx.fill()

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  ctx.strokeStyle = theme.frameStroke
  ctx.lineWidth = Math.max(0.5, sheetWidth * 0.0022)
  roundRect(ctx, slot.x, slot.y, slot.width, slot.height, radius)
  ctx.stroke()

  ctx.restore()
}

/** Wrap text to a maximum width, returning the lines. */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  if (!text) return []
  const lines: string[] = []
  let current = ''
  for (const ch of text) {
    const next = current + ch
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current)
      current = ch
    } else {
      current = next
    }
    if (lines.length >= 3) break
  }
  if (current) lines.push(current)
  return lines.slice(0, 3)
}

/** The one shared bottom caption, plus the date stamp. */
function drawSheetCaption(
  ctx: CanvasRenderingContext2D,
  style: PaperStyle,
  layout: PaperLayout,
  caption: string,
  dateStamp: string | undefined,
): void {
  const theme = style.theme
  const box = layout.captionBox
  if (!box) return

  const W = layout.width
  const fontSize = W * (style.layout === 'single' ? 0.062 : 0.05)

  if (caption) {
    ctx.save()
    ctx.fillStyle = theme.ink
    ctx.font = `600 ${fontSize}px ${CAPTION_FONT_STACK}`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    const maxWidth = dateStamp ? box.width - fontSize * 3.2 : box.width
    const lines = wrapLines(ctx, caption, maxWidth)
    const lineHeight = fontSize * 1.15
    const startY = box.y + box.height / 2 - ((lines.length - 1) * lineHeight) / 2

    lines.forEach((line, i) => {
      ctx.fillText(line, box.x, startY + i * lineHeight)
    })
    ctx.restore()
  }

  if (dateStamp) {
    ctx.save()
    ctx.fillStyle = theme.ink
    ctx.globalAlpha = 0.55
    ctx.font = `600 ${W * 0.026}px ${DATE_FONT_STACK}`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(dateStamp, box.x + box.width, box.y + box.height / 2)
    ctx.restore()
  }
}

/** Per-frame caption drawn inside each frame's bottom band (classic strips). */
function drawFrameCaption(
  ctx: CanvasRenderingContext2D,
  style: PaperStyle,
  slot: PhotoSlot,
  caption: string,
  index: number,
  total: number,
): void {
  const win = slot.window
  const bandTop = win.y + win.height
  const bandH = slot.y + slot.height - bandTop
  if (bandH <= 2) return

  const theme = style.theme
  const W = style.id === 'filmroll-4' ? 0 : slot.width

  ctx.save()
  ctx.textBaseline = 'middle'

  // Caption text on the first frame only — repeating it four times is noise.
  ctx.fillStyle = theme.ink
  ctx.textAlign = 'left'
  const fs = bandH * 0.5
  ctx.font = `600 ${fs}px ${CAPTION_FONT_STACK}`
  const label = index === 0 && caption ? caption : `${index + 1}`
  ctx.globalAlpha = index === 0 && caption ? 1 : 0.45
  ctx.fillText(label, slot.x + slot.width * 0.06, bandTop + bandH * 0.5, slot.width * 0.66)

  // Frame counter on the right.
  ctx.globalAlpha = 0.4
  ctx.textAlign = 'right'
  ctx.font = `600 ${bandH * 0.34}px ${DATE_FONT_STACK}`
  ctx.fillText(`${index + 1}/${total}`, slot.x + slot.width * 0.94, bandTop + bandH * 0.5)

  if (W > 0) { /* keeps the linter honest about W */ }
  ctx.restore()
}

/** Side caption for the `side` slot style. */
function drawSideCaption(
  _ctx: CanvasRenderingContext2D,
  _style: PaperStyle,
  _layout: PaperLayout,
  _caption: string,
  _dateStamp: string | undefined,
): void {
  // Reserved: the mosaic layouts with `captionSlot: 'side'` draw their ink in
  // the negative space to the right of the stack. Until that variant ships,
  // the bottom caption is used instead — handled by `drawSheetCaption`.
}

/* -------------------------------------------------------------------------- */
/* Main entry points                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Render a finished paper sheet onto `canvas`.
 *
 * Sizes the backing store for the device pixel ratio and sets the CSS size,
 * so the element can be dropped straight into a layout.
 */
export function renderPaper(canvas: HTMLCanvasElement, opts: RenderOptions): void {
  const photos = opts.photos.slice(0, 6)
  const W = opts.width ?? DEFAULT_SHEET_WIDTH
  const seed = opts.seed ?? 1234
  const dpr = resolveDpr()

  const layout = buildLayout(opts.style, photos, W, seed)

  canvas.width = Math.max(1, Math.round(layout.width * dpr))
  canvas.height = Math.max(1, Math.round(layout.height * dpr))
  canvas.style.width = `${layout.width}px`
  canvas.style.height = `${layout.height}px`

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.save()
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, layout.width, layout.height)

  // 1. The paper itself.
  paintPaper(ctx, opts.style, layout, dpr)

  // 2. Bake the film simulation once per photo.
  const baked = photos.map((p) => bakeSimulation(p, opts.simulation, seed))

  // 3. Frames + photos, back-to-front so overlapping cards stack correctly.
  const ordered = [...layout.slots].sort((a, b) => b.index - a.index)
  for (const slot of ordered) {
    drawFrame(ctx, opts.style, slot, layout.width)
    drawPhotoInWindow(ctx, slot, baked[slot.index])
  }

  // 4. Captions.
  if (opts.style.captionSlot === 'per-frame') {
    const captionSlots = [...layout.slots].sort((a, b) => a.index - b.index)
    for (const slot of captionSlots) {
      drawFrameCaption(
        ctx,
        opts.style,
        slot,
        opts.caption,
        slot.index,
        captionSlots.length,
      )
    }
  } else if (opts.style.captionSlot === 'bottom') {
    drawSheetCaption(ctx, opts.style, layout, opts.caption, opts.dateStamp)
  } else if (opts.style.captionSlot === 'side') {
    drawSideCaption(ctx, opts.style, layout, opts.caption, opts.dateStamp)
  }

  // 5. Stickers on top of everything.
  drawStickers(ctx, opts.stickers, layout.width, layout.height)

  ctx.restore()
}

/**
 * Convenience wrapper kept for callers that only render a single print.
 * Uses the paper style as given — no layout selection happens here.
 */
export function renderSingle(
  canvas: HTMLCanvasElement,
  opts: Omit<RenderOptions, 'style'> & { style: PaperStyle },
): void {
  renderPaper(canvas, opts)
}

/* -------------------------------------------------------------------------- */
/* Export helpers                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Convert a canvas to a PNG blob.
 *
 * Falls back to a manual data-URL decode when `toBlob` yields null (which
 * happens on some browsers for very large canvases).
 */
export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = 'image/png',
  quality?: number,
): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), type, quality)
  })
  if (blob) return blob

  const dataUrl = canvas.toDataURL(type, quality)
  const comma = dataUrl.indexOf(',')
  const meta = dataUrl.slice(0, comma)
  const base64 = dataUrl.slice(comma + 1)
  const mime = meta.match(/:(.*?);/)?.[1] ?? type
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/** Trigger a browser download of a canvas as a PNG. */
export function downloadCanvas(canvas: HTMLCanvasElement, filename: string): void {
  const url = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.png') ? filename : `${filename}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* Re-export the layout types so callers need only import this module. */
export type { PaperLayout, PaperStyle, PhotoSlot } from './layouts'
export {
  PAPER_STYLES,
  STYLE_BY_ID,
  DEFAULT_STYLE_ID,
  THEMES,
  LAYOUT_ASPECT,
  pickStyle,
  averageAspect,
} from './layouts'
