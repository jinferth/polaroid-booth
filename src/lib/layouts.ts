/**
 * Photo-paper designs: the sheet's pattern, the frame arrangement, and the
 * geometry that ties them to actual photos.
 *
 * Three orthogonal concepts:
 *  - **pattern** — what the paper *looks like* (rainbow, gradient, grid…).
 *  - **layout**  — how the photos are arranged on it.
 *  - **fit**     — how each photo is placed in its window.
 *
 * CRITICAL — aspect handling: photo windows are sized from each photo's own
 * aspect ratio, so a portrait shot gets a portrait window. Nothing is ever
 * force-cropped into a square. When a photo still cannot fill its window
 * exactly (because a layout imposes constraints), the window grows the frame
 * to accommodate it and the photo is shown with `contain`-style letterboxing
 * rather than a hard crop.
 */

import type { PhotoFrame } from './polaroid'

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

/** How the photos are arranged on the paper. */
export type LayoutKind =
  | 'auto' // adaptive flow that respects each photo's aspect
  | 'strip' // classic vertical stack of instant frames
  | 'grid' // tidy contact-sheet grid
  | 'hero' // one big photo on top, the rest as a filmstrip beneath
  | 'single' // one large print
  | 'duo' // two photos side by side
  | 'mosaic' // asymmetric editorial collage
  | 'filmroll' // 35mm film strip with sprocket holes

/** Where the caption sits on the paper. */
export type CaptionSlot = 'bottom' | 'per-frame' | 'none' | 'side'

/**
 * The paper's decorative pattern — this is what makes a "rainbow paper"
 * different from a plain cream one.
 */
export type PaperPatternKind =
  | 'plain' // flat colour
  | 'rainbow' // full-width spectral bands
  | 'gradient' // two-colour diagonal wash
  | 'sunset' // warm vertical wipe
  | 'ocean' // cool vertical wipe
  | 'checker' // gingham grid
  | 'dots' // polka dots
  | 'stars' // scattered sparkles
  | 'confetti' // scattered coloured flakes
  | 'grid' // graph-paper ruling
  | 'stripes' // diagonal candy stripes
  | 'aurora' // soft multi-stop blossom gradient

/** One stop in a pattern's palette. */
export interface PatternStop {
  color: string
  /** Relative position, 0..1. */
  at: number
}

export interface PaperPattern {
  kind: PaperPatternKind
  /** Palette in paint order. `plain` uses only the first stop. */
  stops: PatternStop[]
  /** Pattern strength, 0..1. Applies as an alpha over the base colour. */
  intensity: number
  /** Base colour painted beneath the pattern. */
  base: string
  /** Whether the pattern draws its decorative marks in white or ink. */
  markColor?: string
}

/** The paper itself. */
export interface PaperTheme {
  id: string
  name: string
  /** Chinese description for the picker. */
  blurb: string
  /** The decorative pattern. */
  pattern: PaperPattern
  /** Frame (border) colour — the "white" of a classic Polaroid. */
  frame: string
  /** Inner hairline stroke drawn around each frame. */
  frameStroke: string
  /** Corner radius as a fraction of the shorter frame side. */
  radius: number
  /** Shadow colour under each frame. */
  shadow: string
  /** Ink colour for captions and stamps. */
  ink: string
  /** A CSS value for the picker swatch (usually a gradient). */
  swatch: string
  /** Draw a subtle deckled/aged edge on the paper. */
  deckle: boolean
}

/** A complete paper design: layout + theme. */
export interface PaperStyle {
  id: string
  /** Chinese name shown in the picker. */
  name: string
  layout: LayoutKind
  theme: PaperTheme
  captionSlot: CaptionSlot
  /** How many photos this design wants. Used by the auto-picker. */
  prefers: readonly number[]
  /**
   * Preferred source aspect. `any` works for every photo; `portrait`/`landscape`
   * are used to pick a better-fitting design automatically.
   */
  prefersShape: 'any' | 'portrait' | 'landscape'
  /** How good a fit this design is for the given photo count (0..1). */
  fun: number
}

/** One photo's placement on the paper. */
export interface PhotoSlot {
  /** Index of the photo from the input list. */
  index: number
  /** Frame rectangle in logical px. */
  x: number
  y: number
  width: number
  height: number
  /**
   * Photo window inside the frame. Its aspect matches the photo's own
   * aspect, so the photo is drawn without any cropping.
   */
  window: { x: number; y: number; width: number; height: number }
  /** Rotation in radians around the frame centre. */
  rotation: number
  /** Optional per-slot caption / label (for multi-frame layouts). */
  label?: string
}

/** The fully-resolved geometry of a paper sheet. */
export interface PaperLayout {
  styleId: string
  /** Total logical size of the sheet. */
  width: number
  height: number
  slots: PhotoSlot[]
  /** Where the single bottom caption should be drawn, if `captionSlot` allows. */
  captionBox: { x: number; y: number; width: number; height: number } | null
}

/* -------------------------------------------------------------------------- */
/* Aspect-preserving window fitting                                           */
/* -------------------------------------------------------------------------- */

/** A photo's aspect ratio, guarded against zero/invalid dimensions. */
export function aspectOf(photo: PhotoFrame | undefined, fallback = 4 / 3): number {
  if (!photo) return fallback
  const w = photo.width
  const h = photo.height
  if (!(w > 0) || !(h > 0)) return fallback
  const ratio = w / h
  if (!Number.isFinite(ratio) || ratio <= 0) return fallback
  // Clamp absurd panoramas / extremely tall images to a sane band.
  return Math.min(3.2, Math.max(0.32, ratio))
}

/**
 * Fit a photo window **inside** a box without cropping.
 *
 * Unlike a cover-fit, this never clips the image: the window shrinks (in the
 * axis that has spare room) until the photo fits entirely. Returns the window
 * rect centred in the box.
 */
export function fitWindowInside(
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  aspect: number,
): { x: number; y: number; width: number; height: number } {
  if (boxW <= 0 || boxH <= 0 || aspect <= 0) {
    return { x: boxX, y: boxY, width: Math.max(1, boxW), height: Math.max(1, boxH) }
  }
  const boxAspect = boxW / boxH
  let w: number
  let h: number
  if (aspect > boxAspect) {
    // Photo is wider than the box → full width, shorter height.
    w = boxW
    h = boxW / aspect
  } else {
    // Photo is taller than the box → full height, narrower width.
    h = boxH
    w = boxH * aspect
  }
  return {
    x: boxX + (boxW - w) / 2,
    y: boxY + (boxH - h) / 2,
    width: w,
    height: h,
  }
}

/* Note: the per-layout functions below position windows directly via
 * `fitWindowInside`, because the frame height must react to the fitted
 * window height. Keeping the maths inline makes that relationship explicit. */

/* -------------------------------------------------------------------------- */
/* Patterns                                                                   */
/* -------------------------------------------------------------------------- */

const stop = (color: string, at: number): PatternStop => ({ color, at })

export const PATTERNS: Record<string, PaperPattern> = {
  plainCream: {
    kind: 'plain',
    base: '#f1e8d8',
    stops: [stop('#f1e8d8', 0)],
    intensity: 1,
  },
  rainbow: {
    kind: 'rainbow',
    base: '#fffdf8',
    stops: [
      stop('#f7b3ab', 0),
      stop('#f8cf9a', 0.18),
      stop('#f6e79b', 0.34),
      stop('#b9db9f', 0.5),
      stop('#9ecfe0', 0.66),
      stop('#b6b6e2', 0.82),
      stop('#dcb0dd', 1),
    ],
    intensity: 1,
  },
  rainbowSoft: {
    kind: 'rainbow',
    base: '#fffdf9',
    stops: [
      stop('#fbe3de', 0),
      stop('#fcefd9', 0.25),
      stop('#f7f2d8', 0.4),
      stop('#e2f0e2', 0.55),
      stop('#dcebf3', 0.7),
      stop('#e4e1f0', 0.85),
      stop('#f0e2ef', 1),
    ],
    intensity: 1,
  },
  sakura: {
    kind: 'aurora',
    base: '#fdf3f4',
    stops: [
      stop('#fbe6ea', 0),
      stop('#f8dde3', 0.45),
      stop('#e3ecf7', 1),
    ],
    intensity: 0.9,
    markColor: 'rgba(220,150,170,0.5)',
  },
  sunset: {
    kind: 'sunset',
    base: '#fff6ea',
    stops: [
      stop('#ffd9a0', 0),
      stop('#ffb68a', 0.42),
      stop('#f79b9b', 1),
    ],
    intensity: 0.95,
  },
  ocean: {
    kind: 'ocean',
    base: '#eef6fb',
    stops: [
      stop('#dff0fa', 0),
      stop('#c3e2f2', 0.5),
      stop('#9fcadd', 1),
    ],
    intensity: 0.9,
    markColor: 'rgba(120,170,200,0.45)',
  },
  gingham: {
    kind: 'checker',
    base: '#fbf4ec',
    stops: [stop('#f2d9d1', 0), stop('#d8e5d5', 1)],
    intensity: 0.8,
    markColor: 'rgba(200,120,110,0.35)',
  },
  polka: {
    kind: 'dots',
    base: '#fdf8ee',
    stops: [stop('#f3c9b8', 0), stop('#f6ddc0', 1)],
    intensity: 0.9,
    markColor: 'rgba(255,255,255,0.9)',
  },
  sparkle: {
    kind: 'stars',
    base: '#f4f2ff',
    stops: [stop('#e8e4fb', 0), stop('#f7e9f4', 1)],
    intensity: 0.9,
    markColor: 'rgba(255,255,255,0.95)',
  },
  confetti: {
    kind: 'confetti',
    base: '#fffdf6',
    stops: [stop('#fff3d6', 0), stop('#ffe6e6', 1)],
    intensity: 0.85,
    markColor: 'rgba(210,80,60,0.55)',
  },
  graph: {
    kind: 'grid',
    base: '#f7f6f2',
    stops: [stop('#f7f6f2', 0)],
    intensity: 1,
    markColor: 'rgba(90,100,120,0.22)',
  },
  candy: {
    kind: 'stripes',
    base: '#fff9f4',
    stops: [stop('#fbd3c4', 0), stop('#fbe9c9', 1)],
    intensity: 0.9,
    markColor: 'rgba(240,170,150,0.5)',
  },
  midnight: {
    kind: 'gradient',
    base: '#1b1a18',
    stops: [stop('#2b2a26', 0), stop('#141312', 1)],
    intensity: 1,
  },
  newsprint: {
    kind: 'plain',
    base: '#e8e4da',
    stops: [stop('#e8e4da', 0)],
    intensity: 1,
  },
  kraft: {
    kind: 'plain',
    base: '#c9a678',
    stops: [stop('#cfad82', 0), stop('#b8905f', 1)],
    intensity: 1,
  },
}

/* -------------------------------------------------------------------------- */
/* Themes                                                                     */
/* -------------------------------------------------------------------------- */

/** A small CSS gradient string for a pattern, used by picker swatches. */
export function patternToCss(pattern: PaperPattern): string {
  const cs = pattern.stops
  if (cs.length === 0) return pattern.base
  if (pattern.kind === 'plain') return pattern.base
  const list = cs.map((s) => `${s.color} ${Math.round(s.at * 100)}%`).join(', ')
  if (pattern.kind === 'rainbow') {
    return `linear-gradient(160deg, ${list})`
  }
  if (pattern.kind === 'gradient') return `linear-gradient(150deg, ${list})`
  return `linear-gradient(160deg, ${list})`
}

export const THEMES: Record<string, PaperTheme> = {
  classic: {
    id: 'classic',
    name: '经典白',
    blurb: '真·拍立得白边',
    pattern: PATTERNS.plainCream!,
    frame: '#ffffff',
    frameStroke: 'rgba(0,0,0,0.07)',
    radius: 0.02,
    shadow: 'rgba(60,45,30,0.26)',
    ink: '#2a231d',
    swatch: '#ffffff',
    deckle: false,
  },
  rainbow: {
    id: 'rainbow',
    name: '彩虹相纸',
    blurb: '七彩渐层，最抓眼',
    pattern: PATTERNS.rainbow!,
    frame: '#ffffff',
    frameStroke: 'rgba(120,110,160,0.18)',
    radius: 0.025,
    shadow: 'rgba(90,80,120,0.3)',
    ink: '#3d3350',
    swatch: patternToCss(PATTERNS.rainbow!),
    deckle: false,
  },
  rainbowSoft: {
    id: 'rainbowSoft',
    name: '柔彩相纸',
    blurb: '低饱和彩虹',
    pattern: PATTERNS.rainbowSoft!,
    frame: '#ffffff',
    frameStroke: 'rgba(140,130,160,0.14)',
    radius: 0.025,
    shadow: 'rgba(90,85,110,0.22)',
    ink: '#4a4458',
    swatch: patternToCss(PATTERNS.rainbowSoft!),
    deckle: false,
  },
  sakura: {
    id: 'sakura',
    name: '樱花相纸',
    blurb: '春日樱粉',
    pattern: PATTERNS.sakura!,
    frame: '#fffbfc',
    frameStroke: 'rgba(180,110,130,0.16)',
    radius: 0.03,
    shadow: 'rgba(160,100,120,0.24)',
    ink: '#5c3b45',
    swatch: patternToCss(PATTERNS.sakura!),
    deckle: true,
  },
  sunset: {
    id: 'sunset',
    name: '日落相纸',
    blurb: '橘粉晚霞',
    pattern: PATTERNS.sunset!,
    frame: '#fffdf9',
    frameStroke: 'rgba(200,120,90,0.16)',
    radius: 0.025,
    shadow: 'rgba(190,110,80,0.26)',
    ink: '#5a3325',
    swatch: patternToCss(PATTERNS.sunset!),
    deckle: false,
  },
  ocean: {
    id: 'ocean',
    name: '海洋相纸',
    blurb: '清透海蓝',
    pattern: PATTERNS.ocean!,
    frame: '#fbfeff',
    frameStroke: 'rgba(80,120,150,0.16)',
    radius: 0.025,
    shadow: 'rgba(60,100,130,0.24)',
    ink: '#26424f',
    swatch: patternToCss(PATTERNS.ocean!),
    deckle: false,
  },
  gingham: {
    id: 'gingham',
    name: '格子相纸',
    blurb: '野餐布格纹',
    pattern: PATTERNS.gingham!,
    frame: '#fffdfa',
    frameStroke: 'rgba(160,110,100,0.18)',
    radius: 0.02,
    shadow: 'rgba(140,90,80,0.22)',
    ink: '#4c322c',
    swatch:
      'repeating-linear-gradient(0deg, rgba(242,217,209,0.9) 0 6px, transparent 6px 12px), repeating-linear-gradient(90deg, rgba(216,229,213,0.9) 0 6px, transparent 6px 12px), #fbf4ec',
    deckle: false,
  },
  polka: {
    id: 'polka',
    name: '圆点相纸',
    blurb: '奶油波点',
    pattern: PATTERNS.polka!,
    frame: '#fffdf8',
    frameStroke: 'rgba(180,130,110,0.16)',
    radius: 0.02,
    shadow: 'rgba(150,110,90,0.22)',
    ink: '#4a3528',
    swatch:
      'radial-gradient(circle, rgba(255,255,255,0.95) 2px, transparent 2.5px) 0 0 / 11px 11px, #f7dcc9',
    deckle: false,
  },
  sparkle: {
    id: 'sparkle',
    name: '星星相纸',
    blurb: '星屑闪烁',
    pattern: PATTERNS.sparkle!,
    frame: '#fdfcff',
    frameStroke: 'rgba(130,120,170,0.16)',
    radius: 0.025,
    shadow: 'rgba(100,90,140,0.24)',
    ink: '#3c3552',
    swatch: patternToCss(PATTERNS.sparkle!),
    deckle: false,
  },
  confetti: {
    id: 'confetti',
    name: '彩屑相纸',
    blurb: '派对彩纸屑',
    pattern: PATTERNS.confetti!,
    frame: '#fffdf7',
    frameStroke: 'rgba(170,120,90,0.16)',
    radius: 0.02,
    shadow: 'rgba(150,100,80,0.24)',
    ink: '#4a3222',
    swatch: patternToCss(PATTERNS.confetti!),
    deckle: false,
  },
  graph: {
    id: 'graph',
    name: '方格相纸',
    blurb: '绘图纸网格',
    pattern: PATTERNS.graph!,
    frame: '#fffefb',
    frameStroke: 'rgba(100,110,130,0.2)',
    radius: 0,
    shadow: 'rgba(80,90,110,0.18)',
    ink: '#2c3340',
    swatch:
      'repeating-linear-gradient(0deg, rgba(90,100,120,0.18) 0 1px, transparent 1px 9px), repeating-linear-gradient(90deg, rgba(90,100,120,0.18) 0 1px, transparent 1px 9px), #f7f6f2',
    deckle: false,
  },
  candy: {
    id: 'candy',
    name: '糖果相纸',
    blurb: '斜条纹糖果',
    pattern: PATTERNS.candy!,
    frame: '#fffdfa',
    frameStroke: 'rgba(190,130,110,0.16)',
    radius: 0.025,
    shadow: 'rgba(170,110,90,0.22)',
    ink: '#54322a',
    swatch:
      'repeating-linear-gradient(45deg, rgba(251,211,196,0.95) 0 7px, rgba(251,233,201,0.95) 7px 14px)',
    deckle: false,
  },
  midnight: {
    id: 'midnight',
    name: '暗房黑',
    blurb: '黑边负片',
    pattern: PATTERNS.midnight!,
    frame: '#0e0d0c',
    frameStroke: 'rgba(255,255,255,0.12)',
    radius: 0,
    shadow: 'rgba(0,0,0,0.55)',
    ink: '#e8e0d2',
    swatch: patternToCss(PATTERNS.midnight!),
    deckle: false,
  },
  newsprint: {
    id: 'newsprint',
    name: '报纸灰',
    blurb: '新闻纸质感',
    pattern: PATTERNS.newsprint!,
    frame: '#f7f5f0',
    frameStroke: 'rgba(40,38,34,0.2)',
    radius: 0,
    shadow: 'rgba(50,46,40,0.2)',
    ink: '#2b2822',
    swatch: '#e8e4da',
    deckle: true,
  },
  kraft: {
    id: 'kraft',
    name: '牛皮纸',
    blurb: '手作牛皮纸袋',
    pattern: PATTERNS.kraft!,
    frame: '#e6d3b4',
    frameStroke: 'rgba(90,60,30,0.22)',
    radius: 0.02,
    shadow: 'rgba(80,55,25,0.3)',
    ink: '#4d3316',
    swatch: patternToCss(PATTERNS.kraft!),
    deckle: true,
  },
  cream: {
    id: 'cream',
    name: '奶油纸',
    blurb: '暖调旧纸',
    pattern: PATTERNS.plainCream!,
    frame: '#fdf8ee',
    frameStroke: 'rgba(120,90,50,0.16)',
    radius: 0.012,
    shadow: 'rgba(90,66,40,0.24)',
    ink: '#4a3a24',
    swatch: '#efe4d0',
    deckle: true,
  },
  film: {
    id: 'film',
    name: '胶片条',
    blurb: '35mm 齿孔片',
    pattern: PATTERNS.midnight!,
    frame: '#0b0a0d',
    frameStroke: 'rgba(255,255,255,0.14)',
    radius: 0.006,
    shadow: 'rgba(0,0,0,0.6)',
    ink: '#e9e2d2',
    swatch: '#17161a',
    deckle: false,
  },
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */

export const PAPER_STYLES: PaperStyle[] = [
  {
    id: 'rainbow-auto',
    name: '彩虹相纸',
    layout: 'auto',
    theme: THEMES.rainbow!,
    captionSlot: 'bottom',
    prefers: [1, 2, 3, 4],
    prefersShape: 'any',
    fun: 1.15,
  },
  {
    id: 'instant-4',
    name: '四连拍立得',
    layout: 'strip',
    theme: THEMES.classic!,
    captionSlot: 'per-frame',
    prefers: [4],
    prefersShape: 'any',
    fun: 1,
  },
  {
    id: 'rainbow-strip',
    name: '彩虹连拍',
    layout: 'strip',
    theme: THEMES.rainbowSoft!,
    captionSlot: 'per-frame',
    prefers: [2, 3, 4],
    prefersShape: 'any',
    fun: 0.98,
  },
  {
    id: 'contact-sheet',
    name: '接触印相表',
    layout: 'grid',
    theme: THEMES.newsprint!,
    captionSlot: 'bottom',
    prefers: [4, 3, 2],
    prefersShape: 'any',
    fun: 0.9,
  },
  {
    id: 'hero-strip',
    name: '主片 + 胶片条',
    layout: 'hero',
    theme: THEMES.cream!,
    captionSlot: 'bottom',
    prefers: [4, 3, 2],
    prefersShape: 'landscape',
    fun: 0.95,
  },
  {
    id: 'sakura-auto',
    name: '樱花相纸',
    layout: 'auto',
    theme: THEMES.sakura!,
    captionSlot: 'bottom',
    prefers: [1, 2, 3, 4],
    prefersShape: 'portrait',
    fun: 0.93,
  },
  {
    id: 'sunset-auto',
    name: '日落相纸',
    layout: 'auto',
    theme: THEMES.sunset!,
    captionSlot: 'bottom',
    prefers: [1, 2, 3, 4],
    prefersShape: 'any',
    fun: 0.95,
  },
  {
    id: 'ocean-auto',
    name: '海洋相纸',
    layout: 'auto',
    theme: THEMES.ocean!,
    captionSlot: 'bottom',
    prefers: [1, 2, 3, 4],
    prefersShape: 'any',
    fun: 0.92,
  },
  {
    id: 'gingham-grid',
    name: '格子相纸',
    layout: 'grid',
    theme: THEMES.gingham!,
    captionSlot: 'bottom',
    prefers: [2, 4],
    prefersShape: 'any',
    fun: 0.88,
  },
  {
    id: 'polka-auto',
    name: '圆点相纸',
    layout: 'auto',
    theme: THEMES.polka!,
    captionSlot: 'bottom',
    prefers: [1, 2, 3],
    prefersShape: 'portrait',
    fun: 0.86,
  },
  {
    id: 'sparkle-auto',
    name: '星星相纸',
    layout: 'auto',
    theme: THEMES.sparkle!,
    captionSlot: 'bottom',
    prefers: [1, 2, 3, 4],
    prefersShape: 'any',
    fun: 0.9,
  },
  {
    id: 'confetti-auto',
    name: '彩屑相纸',
    layout: 'auto',
    theme: THEMES.confetti!,
    captionSlot: 'bottom',
    prefers: [3, 4],
    prefersShape: 'any',
    fun: 0.87,
  },
  {
    id: 'graph-auto',
    name: '方格相纸',
    layout: 'auto',
    theme: THEMES.graph!,
    captionSlot: 'bottom',
    prefers: [1, 2, 3, 4],
    prefersShape: 'any',
    fun: 0.82,
  },
  {
    id: 'candy-auto',
    name: '糖果相纸',
    layout: 'auto',
    theme: THEMES.candy!,
    captionSlot: 'bottom',
    prefers: [2, 3, 4],
    prefersShape: 'any',
    fun: 0.84,
  },
  {
    id: 'filmroll-4',
    name: '35mm 胶片条',
    layout: 'filmroll',
    theme: THEMES.film!,
    captionSlot: 'per-frame',
    prefers: [4, 3, 2],
    prefersShape: 'landscape',
    fun: 0.92,
  },
  {
    id: 'polaroid-single',
    name: '单张大相纸',
    layout: 'single',
    theme: THEMES.classic!,
    captionSlot: 'bottom',
    prefers: [1],
    prefersShape: 'any',
    fun: 1,
  },
  {
    id: 'duo-print',
    name: '双联印相',
    layout: 'duo',
    theme: THEMES.rainbowSoft!,
    captionSlot: 'bottom',
    prefers: [2],
    prefersShape: 'any',
    fun: 1,
  },
  {
    id: 'mosaic-art',
    name: '杂志拼贴',
    layout: 'mosaic',
    theme: THEMES.kraft!,
    captionSlot: 'bottom',
    prefers: [3, 4],
    prefersShape: 'any',
    fun: 0.88,
  },
  {
    id: 'contact-dark',
    name: '暗房接触表',
    layout: 'grid',
    theme: THEMES.midnight!,
    captionSlot: 'bottom',
    prefers: [4, 3],
    prefersShape: 'any',
    fun: 0.85,
  },
  {
    id: 'midnight-triple',
    name: '暗房三联',
    layout: 'mosaic',
    theme: THEMES.midnight!,
    captionSlot: 'side',
    prefers: [3, 2],
    prefersShape: 'portrait',
    fun: 0.8,
  },
]

export const STYLE_BY_ID: Record<string, PaperStyle> = PAPER_STYLES.reduce<Record<string, PaperStyle>>(
  (acc, s) => {
    acc[s.id] = s
    return acc
  },
  {},
)

/** The style used when nothing better fits. */
export const DEFAULT_STYLE_ID = 'rainbow-auto'

/* -------------------------------------------------------------------------- */
/* Auto-selection                                                             */
/* -------------------------------------------------------------------------- */

/** Average aspect ratio (w/h) of a set of photos. */
export function averageAspect(photos: readonly PhotoFrame[]): number {
  if (photos.length === 0) return 1
  const total = photos.reduce((sum, p) => sum + aspectOf(p), 0)
  return total / photos.length
}

export interface PickOptions {
  /** Restrict the choice to these style ids. */
  among?: readonly string[]
}

/**
 * Pick the paper style that best suits the given photos.
 *
 * Scoring blends three signals:
 *  - **photo count** — a design listing this count is a strong match;
 *  - **orientation** — portrait photos favour portrait-oriented papers;
 *  - **intrinsic fun** — some layouts simply read better, used as a tiebreak.
 *
 * Deterministic for identical input, so a given upload always produces the
 * same design.
 */
export function pickStyle(
  photos: readonly PhotoFrame[],
  options: PickOptions = {},
): PaperStyle {
  const count = photos.length
  if (count === 0) return STYLE_BY_ID[DEFAULT_STYLE_ID] as PaperStyle

  const aspect = averageAspect(photos)
  const isPortrait = aspect < 0.95
  const isLandscape = aspect > 1.15

  const pool = (options.among
    ? PAPER_STYLES.filter((s) => options.among?.includes(s.id))
    : PAPER_STYLES
  ).filter((s) => Boolean(s.theme))

  let best = pool[0] as PaperStyle
  let bestScore = -Infinity

  for (const style of pool) {
    let score = style.fun

    // Photo count: exact match is the strongest signal.
    if (style.prefers.includes(count)) score += 1.0
    else {
      const nearest = Math.min(...style.prefers.map((n) => Math.abs(n - count)))
      score += 0.55 - nearest * 0.18
    }

    // Orientation fit.
    if (style.prefersShape === 'portrait' && isPortrait) score += 0.35
    if (style.prefersShape === 'landscape' && isLandscape) score += 0.35
    if (style.prefersShape === 'any') score += 0.12

    // A lone photo should never be forced into a multi-photo grid.
    if (count === 1 && style.layout !== 'single' && style.layout !== 'auto') score -= 2.5
    if (count > 1 && style.layout === 'single') score -= 2.5

    // A 4-up strip with only two photos wastes most of the paper.
    if (style.layout === 'strip' && count < 3) score -= 0.6

    if (score > bestScore) {
      bestScore = score
      best = style
    }
  }

  return best
}

/* -------------------------------------------------------------------------- */
/* Geometry                                                                   */
/* -------------------------------------------------------------------------- */

/** Typical sheet aspect (w/h) per layout, used by picker previews. */
export const LAYOUT_ASPECT: Record<LayoutKind, number> = {
  auto: 0.8,
  strip: 0.56,
  grid: 0.86,
  hero: 0.78,
  single: 0.84,
  duo: 0.72,
  mosaic: 0.8,
  filmroll: 0.62,
}

const SPROCKET = 0.11

/**
 * Build the geometry for a sheet.
 *
 * All coordinates are logical px relative to the sheet's top-left corner.
 * The renderer multiplies by the device-pixel ratio when painting.
 */
export function buildLayout(
  style: PaperStyle,
  photos: readonly PhotoFrame[],
  width: number,
  seed = 1234,
): PaperLayout {
  const count = Math.max(1, photos.length)
  const W = width
  const rand = createRandom(seed)
  const aspects = photos.map((p) => aspectOf(p))

  switch (style.layout) {
    case 'single':
      return layoutSingle(style, W, aspects)
    case 'duo':
      return layoutDuo(style, W, count, aspects)
    case 'grid':
      return layoutGrid(style, W, count, aspects, rand)
    case 'hero':
      return layoutHero(style, W, count, aspects)
    case 'mosaic':
      return layoutMosaic(style, W, count, aspects, rand)
    case 'filmroll':
      return layoutFilmroll(style, W, count, aspects)
    case 'strip':
      return layoutStrip(style, W, count, aspects, rand)
    case 'auto':
    default:
      return layoutAuto(style, W, count, aspects, rand)
  }
}

function createRandom(seed: number): () => number {
  let state = Math.floor(seed) >>> 0
  if (state === 0) state = 0x9e3779b9
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function jitter(rand: () => number, maxDeg = 3): number {
  return ((rand() * 2 - 1) * maxDeg * Math.PI) / 180
}

/* --- auto: aspect-respecting flow --------------------------------------- */

/**
 * The adaptive layout: every photo gets a window shaped like itself, stacked
 * in a single column (portrait photos) or laid out as a balanced two-column
 * contact sheet (landscape photos).
 *
 * This is the design that never crops.
 */
function layoutAuto(
  style: PaperStyle,
  W: number,
  count: number,
  aspects: number[],
  rand: () => number,
): PaperLayout {
  const n = Math.min(count, 9)
  const margin = W * 0.055
  const gutter = W * 0.032
  const pad = W * 0.028
  const capBand = W * 0.075
  const innerW = W - margin * 2

  // Decide columns from the overall shape of the set.
  const avg = aspects.slice(0, n).reduce((a, b) => a + b, 0) / Math.max(1, n)
  const cols = n === 1 ? 1 : avg < 0.95 ? 1 : n <= 4 ? 2 : 3

  const cellW = cols === 1 ? innerW : (innerW - gutter * (cols - 1)) / cols

  const slots: PhotoSlot[] = []
  const colHeights = new Array<number>(cols).fill(0)

  for (let i = 0; i < n; i += 1) {
    const a = aspects[i] ?? 4 / 3
    // Place into the shortest column so the sheet stays balanced.
    let col = 0
    for (let c = 1; c < cols; c += 1) {
      if ((colHeights[c] ?? 0) < (colHeights[col] ?? 0)) col = c
    }

    // Window width fits the cell; height follows the photo's own aspect.
    let winW = cellW - pad * 2
    let winH = winW / a

    // Very tall photos would make the sheet absurd — cap the window height.
    const maxH = W * 1.15
    if (winH > maxH) {
      winH = maxH
      winW = winH * a
    }

    const frameW = cellW
    const frameH = winH + pad * 2 + capBand
    const x = margin + col * (cellW + gutter)
    const y = margin + (colHeights[col] ?? 0)

    slots.push({
      index: i,
      x,
      y,
      width: frameW,
      height: frameH,
      rotation: n === 1 ? jitter(rand, 1.2) : jitter(rand, 0.8),
      window: {
        x: x + (frameW - winW) / 2,
        y: y + pad,
        width: winW,
        height: winH,
      },
    })

    colHeights[col] = (colHeights[col] ?? 0) + frameH + gutter
  }

  const tallest = Math.max(...colHeights.filter((h) => h > 0), 0)
  const H = Math.round(margin + tallest + margin * 1.55)

  return {
    styleId: style.id,
    width: W,
    height: H,
    slots,
    captionBox: {
      x: margin,
      y: H - margin * 1.15,
      width: innerW,
      height: margin * 0.8,
    },
  }
}

/* --- strip: vertical stack with real aspect ----------------------------- */

function layoutStrip(
  style: PaperStyle,
  W: number,
  count: number,
  aspects: number[],
  rand: () => number,
): PaperLayout {
  const total = Math.min(Math.max(count, 1), 4)
  const side = W * 0.055
  const frameW = W - side * 2
  const pad = frameW * 0.05
  const capH = frameW * 0.24
  const top = W * 0.06

  const slots: PhotoSlot[] = []
  let y = top

  for (let i = 0; i < total; i += 1) {
    const a = aspects[i] ?? 1
    // Window follows the photo's aspect, capped so one tall shot cannot
    // dominate the strip.
    let winW = frameW - pad * 2
    let winH = winW / a
    const maxWinH = frameW * 1.25
    if (winH > maxWinH) {
      winH = maxWinH
      winW = winH * a
    }
    const frameH = winH + pad * 2 + capH
    const sway = (rand() * 2 - 1) * W * 0.012

    slots.push({
      index: i,
      x: side + sway,
      y,
      width: frameW,
      height: frameH,
      rotation: jitter(rand, 2),
      window: {
        x: side + sway + (frameW - winW) / 2,
        y: y + pad,
        width: winW,
        height: winH,
      },
    })

    // Overlap the caption band of the previous frame slightly.
    y += frameH - capH * 0.42
  }

  const last = slots[slots.length - 1]
  const H = Math.round((last ? last.y + last.height : top) + W * 0.06)

  return { styleId: style.id, width: W, height: H, slots, captionBox: null }
}

/* --- grid: contact sheet, aspect-fit windows --------------------------- */

function layoutGrid(
  style: PaperStyle,
  W: number,
  count: number,
  aspects: number[],
  _rand: () => number,
): PaperLayout {
  const total = Math.min(Math.max(count, 1), 6)
  const cols = total === 1 ? 1 : total <= 4 ? 2 : 3
  const rows = Math.ceil(total / cols)
  const margin = W * 0.055
  const gutter = W * 0.026
  const cellW = (W - margin * 2 - gutter * (cols - 1)) / cols
  const pad = cellW * 0.04
  const capH = cellW * 0.11

  // Row height follows the tallest photo in that row, so nothing is cropped.
  const rowHeights: number[] = []
  for (let r = 0; r < rows; r += 1) {
    let maxWinH = 0
    for (let c = 0; c < cols; c += 1) {
      const i = r * cols + c
      if (i >= total) continue
      const a = aspects[i] ?? 1
      maxWinH = Math.max(maxWinH, Math.min((cellW - pad * 2) / a, W * 0.9))
    }
    rowHeights.push(maxWinH + pad * 2 + capH)
  }

  const top = margin + W * 0.015
  const totalH = rowHeights.reduce((a, b) => a + b, 0) + gutter * (rows - 1)
  const H = Math.round(top + totalH + margin * 1.45)

  const slots: PhotoSlot[] = []
  let rowY = top
  for (let r = 0; r < rows; r += 1) {
    const rowH = rowHeights[r] ?? 0
    for (let c = 0; c < cols; c += 1) {
      const i = r * cols + c
      if (i >= total) continue
      const a = aspects[i] ?? 1
      const x = margin + c * (cellW + gutter)
      const fitted = fitWindowInside(
        x + pad,
        rowY + pad,
        cellW - pad * 2,
        rowH - pad * 2 - capH,
        a,
      )
      slots.push({
        index: i,
        x,
        y: rowY,
        width: cellW,
        height: rowH,
        rotation: 0,
        window: fitted,
      })
    }
    rowY += rowH + gutter
  }

  return {
    styleId: style.id,
    width: W,
    height: H,
    slots,
    captionBox: { x: margin, y: H - margin * 1.15, width: W - margin * 2, height: margin * 0.8 },
  }
}

/* --- hero: big hero photo + small ones, all aspect-true ---------------- */

function layoutHero(
  style: PaperStyle,
  W: number,
  count: number,
  aspects: number[],
): PaperLayout {
  const total = Math.min(Math.max(count, 1), 4)
  const margin = W * 0.055
  const pad = W * 0.026
  const innerW = W - margin * 2
  const gap = W * 0.04
  const capBand = W * 0.07

  // Hero gets the widest photo's aspect so the big frame feels natural.
  const heroAspect = Math.min(2.2, Math.max(0.85, aspects[0] ?? 4 / 3))
  const heroWinW = innerW - pad * 2
  const heroWinH = Math.min(heroWinW / heroAspect, W * 0.85)
  const heroW = innerW
  const heroH = heroWinH + pad * 2 + capBand

  const top = margin
  const slots: PhotoSlot[] = [
    {
      index: 0,
      x: margin,
      y: top,
      width: heroW,
      height: heroH,
      rotation: 0,
      window: {
        x: margin + (heroW - heroWinW) / 2,
        y: top + pad,
        width: heroWinW,
        height: heroWinH,
      },
    },
  ]

  let H = top + heroH + margin * 1.4

  if (total > 1) {
    const stripCount = total - 1
    const stripGutter = W * 0.02
    const stripCellW = (innerW - stripGutter * (stripCount - 1)) / stripCount
    const stripPad = stripCellW * 0.045

    // Use the tallest strip photo to size the row uniformly.
    let maxWinH = 0
    for (let i = 1; i < total; i += 1) {
      const a = aspects[i] ?? 1
      maxWinH = Math.max(maxWinH, Math.min((stripCellW - stripPad * 2) / a, W * 0.42))
    }
    const stripCapH = stripCellW * 0.12
    const stripH = maxWinH + stripPad * 2 + stripCapH

    for (let i = 1; i < total; i += 1) {
      const col = i - 1
      const x = margin + col * (stripCellW + stripGutter)
      const y = top + heroH + gap
      const a = aspects[i] ?? 1
      const fitted = fitWindowInside(
        x + stripPad,
        y + stripPad,
        stripCellW - stripPad * 2,
        maxWinH,
        a,
      )
      slots.push({
        index: i,
        x,
        y,
        width: stripCellW,
        height: stripH,
        rotation: 0,
        window: fitted,
      })
    }
    H = Math.round(top + heroH + gap + stripH + margin * 1.45)
  }

  return {
    styleId: style.id,
    width: W,
    height: H,
    slots,
    captionBox: { x: margin, y: H - margin * 1.15, width: innerW, height: margin * 0.8 },
  }
}

/* --- single: one large print, true aspect ------------------------------ */

function layoutSingle(style: PaperStyle, W: number, aspects: number[]): PaperLayout {
  const margin = W * 0.055
  const frameW = W - margin * 2
  const pad = W * 0.042
  const capH = W * 0.2
  const a = aspects[0] ?? 1

  let winW = frameW - pad * 2
  let winH = winW / a
  const maxWinH = W * 1.2
  if (winH > maxWinH) {
    winH = maxWinH
    winW = winH * a
  }

  const frameH = winH + pad * 2 + capH
  const top = margin * 0.7
  const H = Math.round(top + frameH + margin * 1.3)

  return {
    styleId: style.id,
    width: W,
    height: H,
    slots: [
      {
        index: 0,
        x: margin,
        y: top,
        width: frameW,
        height: frameH,
        rotation: 0,
        window: { x: margin + (frameW - winW) / 2, y: top + pad, width: winW, height: winH },
      },
    ],
    captionBox: {
      x: margin + W * 0.045,
      y: top + pad + winH + W * 0.035,
      width: frameW - W * 0.09,
      height: capH * 0.78,
    },
  }
}

/* --- duo: two prints side by side, true aspect ------------------------ */

function layoutDuo(
  style: PaperStyle,
  W: number,
  count: number,
  aspects: number[],
): PaperLayout {
  const total = Math.min(Math.max(count, 1), 2)
  const margin = W * 0.05
  const gutter = W * 0.024
  const cellW = total === 1 ? W - margin * 2 : (W - margin * 2 - gutter) / 2
  const pad = cellW * 0.05
  const capH = cellW * 0.16

  // Common height = tallest window in the row, so both frames align.
  let maxWinH = 0
  for (let i = 0; i < total; i += 1) {
    const a = aspects[i] ?? 1
    maxWinH = Math.max(maxWinH, Math.min((cellW - pad * 2) / a, W * 0.95))
  }
  const frameH = maxWinH + pad * 2 + capH
  const top = margin * 0.85
  const H = Math.round(top + frameH + margin * 1.5)

  const slots: PhotoSlot[] = []
  for (let i = 0; i < total; i += 1) {
    const x = margin + i * (cellW + gutter)
    const a = aspects[i] ?? 1
    slots.push({
      index: i,
      x,
      y: top,
      width: cellW,
      height: frameH,
      rotation: 0,
      window: fitWindowInside(x + pad, top + pad, cellW - pad * 2, maxWinH, a),
    })
  }

  return {
    styleId: style.id,
    width: W,
    height: H,
    slots,
    captionBox: { x: margin, y: H - margin * 1.2, width: W - margin * 2, height: margin * 0.8 },
  }
}

/* --- mosaic: asymmetric collage, aspect-fit --------------------------- */

function layoutMosaic(
  style: PaperStyle,
  W: number,
  count: number,
  aspects: number[],
  rand: () => number,
): PaperLayout {
  // A mosaic needs at least two photos to read as a collage. With only one,
  // fall back to the hero layout so the sheet is not left with empty frames.
  if (count < 2) return layoutHero(style, W, count, aspects)
  const total = Math.min(count, 4)
  const margin = W * 0.045
  const innerW = W - margin * 2
  const pad = W * 0.016
  const gap = W * 0.018

  const bigW = innerW * 0.58
  const smallW = innerW - bigW - gap

  const top = margin
  const slots: PhotoSlot[] = []

  // Big cell on the left.
  const bigAspect = aspects[0] ?? 1
  const bigWinW = bigW - pad * 2
  const bigWinH = Math.min(bigWinW / bigAspect, innerW * 0.95)
  const bigH = bigWinH + pad * 2
  slots.push({
    index: 0,
    x: margin,
    y: top,
    width: bigW,
    height: bigH,
    rotation: jitter(rand, 0.9),
    window: {
      x: margin + (bigW - bigWinW) / 2,
      y: top + pad,
      width: bigWinW,
      height: bigWinH,
    },
  })

  // Stacked small cells on the right.
  const rightCount = total - 1
  const rightCellH = (bigH - gap * (rightCount - 1)) / rightCount

  for (let i = 1; i < total; i += 1) {
    const row = i - 1
    const x = margin + bigW + gap
    const y = top + row * (rightCellH + gap)
    const a = aspects[i] ?? 1
    slots.push({
      index: i,
      x,
      y,
      width: smallW,
      height: rightCellH,
      rotation: jitter(rand, 1.3),
      window: fitWindowInside(x + pad, y + pad, smallW - pad * 2, rightCellH - pad * 2, a),
    })
  }

  const H = Math.round(Math.max(top + bigH, top + rightCount * rightCellH + gap * (rightCount - 1)) + margin * 1.6)

  return {
    styleId: style.id,
    width: W,
    height: H,
    slots,
    captionBox: { x: margin, y: H - margin * 1.3, width: innerW, height: margin * 0.85 },
  }
}

/* --- filmroll: 35mm strip, aspect-fit -------------------------------- */

function layoutFilmroll(
  style: PaperStyle,
  W: number,
  count: number,
  aspects: number[],
): PaperLayout {
  const total = Math.min(Math.max(count, 1), 6)
  const band = W * SPROCKET
  const margin = W * 0.028
  const innerW = W - margin * 2
  const gutter = W * 0.012
  const cellW = (innerW - gutter * (total - 1)) / total
  const pad = cellW * 0.018

  let maxWinH = 0
  for (let i = 0; i < total; i += 1) {
    const a = aspects[i] ?? 1
    maxWinH = Math.max(maxWinH, Math.min((cellW - pad * 2) / a, W * 0.5))
  }
  const frameH = maxWinH + pad * 2
  const top = band + W * 0.024
  const H = Math.round(top + frameH + band + W * 0.024)

  const slots: PhotoSlot[] = []
  for (let i = 0; i < total; i += 1) {
    const x = margin + i * (cellW + gutter)
    const a = aspects[i] ?? 1
    slots.push({
      index: i,
      x,
      y: top,
      width: cellW,
      height: frameH,
      rotation: 0,
      window: fitWindowInside(x + pad, top + pad, cellW - pad * 2, maxWinH, a),
    })
  }

  return { styleId: style.id, width: W, height: H, slots, captionBox: null }
}

/* -------------------------------------------------------------------------- */
/* Pattern painting                                                           */
/* -------------------------------------------------------------------------- */

/** Rounded-rectangle path helper shared by the layout painters. */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

/** Build a gradient from a pattern's stops. */
function gradientOf(
  ctx: CanvasRenderingContext2D,
  pattern: PaperPattern,
  W: number,
  H: number,
  angle: 'v' | 'h' | 'd' = 'd',
): CanvasGradient {
  let grad: CanvasGradient
  if (angle === 'v') grad = ctx.createLinearGradient(0, 0, 0, H)
  else if (angle === 'h') grad = ctx.createLinearGradient(0, 0, W, 0)
  else grad = ctx.createLinearGradient(0, 0, W, H)

  for (const s of pattern.stops) {
    grad.addColorStop(Math.max(0, Math.min(1, s.at)), s.color)
  }
  return grad
}

/**
 * Paint the paper.
 *
 * This is where "rainbow paper" and friends come to life: the pattern decides
 * every pixel behind the frames.
 */
export function paintPaper(
  ctx: CanvasRenderingContext2D,
  style: PaperStyle,
  layout: PaperLayout,
  scale = 1,
): void {
  const { width: W, height: H } = layout
  const theme = style.theme
  const p = theme.pattern

  // Base wash.
  ctx.fillStyle = p.base
  ctx.fillRect(0, 0, W, H)

  const rnd = createRandom(0x9e37)

  switch (p.kind) {
    case 'rainbow': {
      // Vertical spectral bands, like a rainbow gradient paper.
      const grad = ctx.createLinearGradient(0, 0, 0, H)
      for (const s of p.stops) grad.addColorStop(s.at, s.color)
      ctx.save()
      ctx.globalAlpha = p.intensity
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)
      ctx.restore()
      break
    }
    case 'gradient': {
      ctx.save()
      ctx.globalAlpha = p.intensity
      ctx.fillStyle = gradientOf(ctx, p, W, H, 'd')
      ctx.fillRect(0, 0, W, H)
      ctx.restore()
      break
    }
    case 'sunset':
    case 'ocean': {
      ctx.save()
      ctx.globalAlpha = p.intensity
      ctx.fillStyle = gradientOf(ctx, p, W, H, 'v')
      ctx.fillRect(0, 0, W, H)
      ctx.restore()
      break
    }
    case 'aurora': {
      // Soft blurred multi-stop, the "watercolour" look.
      ctx.save()
      ctx.globalAlpha = p.intensity
      ctx.fillStyle = gradientOf(ctx, p, W, H, 'd')
      ctx.fillRect(0, 0, W, H)
      ctx.restore()
      break
    }
    case 'checker': {
      ctx.save()
      ctx.globalAlpha = p.intensity * 0.55
      ctx.fillStyle = p.stops[0]?.color ?? '#eee'
      ctx.fillRect(0, 0, W, H)
      const band = Math.max(6, W * 0.05)
      ctx.globalAlpha = p.intensity * 0.45
      ctx.fillStyle = p.stops[1]?.color ?? '#ddd'
      for (let y = 0; y < H; y += band) {
        for (let x = 0; x < W; x += band) {
          if (((x / band) | 0) % 2 === ((y / band) | 0) % 2) continue
          ctx.fillRect(x, y, band, band)
        }
      }
      break
    }
    case 'dots': {
      ctx.save()
      ctx.globalAlpha = p.intensity
      ctx.fillStyle = gradientOf(ctx, p, W, H, 'd')
      ctx.fillRect(0, 0, W, H)
      const step = Math.max(12, W * 0.085)
      const r = step * 0.22
      ctx.globalAlpha = 1
      ctx.fillStyle = p.markColor ?? 'rgba(255,255,255,0.85)'
      for (let y = step * 0.5; y < H; y += step) {
        for (let x = step * 0.5; x < W; x += step) {
          const ox = ((y / step) | 0) % 2 === 0 ? 0 : step * 0.5
          ctx.beginPath()
          ctx.arc(x + ox, y, r, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.restore()
      break
    }
    case 'stars': {
      ctx.save()
      ctx.globalAlpha = p.intensity
      ctx.fillStyle = gradientOf(ctx, p, W, H, 'd')
      ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = 1
      ctx.fillStyle = p.markColor ?? 'rgba(255,255,255,0.9)'
      const count = Math.round((W * H) / 7000)
      for (let i = 0; i < count; i += 1) {
        const x = rnd() * W
        const y = rnd() * H
        const s = W * (0.006 + rnd() * 0.012)
        drawSparkle(ctx, x, y, s)
      }
      ctx.restore()
      break
    }
    case 'confetti': {
      ctx.save()
      ctx.globalAlpha = p.intensity
      ctx.fillStyle = gradientOf(ctx, p, W, H, 'd')
      ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = 1
      const palette = ['#e8756a', '#f0b45c', '#7fb471', '#6fa8d6', '#b48bd6']
      const count = Math.round((W * H) / 4200)
      for (let i = 0; i < count; i += 1) {
        const x = rnd() * W
        const y = rnd() * H
        const w = W * (0.008 + rnd() * 0.014)
        const h = w * (0.35 + rnd() * 0.4)
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(rnd() * Math.PI * 2)
        ctx.fillStyle = palette[(rnd() * palette.length) | 0] ?? '#e8756a'
        ctx.globalAlpha = 0.55 + rnd() * 0.3
        ctx.fillRect(-w / 2, -h / 2, w, h)
        ctx.restore()
      }
      ctx.restore()
      break
    }
    case 'grid': {
      ctx.save()
      ctx.globalAlpha = p.intensity
      ctx.fillStyle = gradientOf(ctx, p, W, H, 'd')
      ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = 1
      ctx.strokeStyle = p.markColor ?? 'rgba(90,100,120,0.2)'
      ctx.lineWidth = 1
      const step = Math.max(10, W * 0.045)
      for (let x = 0; x <= W; x += step) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, H)
        ctx.stroke()
      }
      for (let y = 0; y <= H; y += step) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(W, y)
        ctx.stroke()
      }
      ctx.restore()
      break
    }
    case 'stripes': {
      ctx.save()
      ctx.globalAlpha = p.intensity
      ctx.fillStyle = p.stops[0]?.color ?? '#fbd3c4'
      ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = p.intensity * 0.75
      ctx.fillStyle = p.stops[1]?.color ?? '#fbe9c9'
      const band = Math.max(10, W * 0.07)
      ctx.save()
      ctx.translate(-H, 0)
      ctx.rotate(-Math.PI / 4)
      for (let x = 0; x < (W + H) * 1.5; x += band * 2) {
        ctx.fillRect(x, -H, band, H * 3)
      }
      ctx.restore()
      ctx.restore()
      break
    }
    case 'plain':
    default: {
      if (p.stops.length > 1) {
        ctx.save()
        ctx.globalAlpha = p.intensity * 0.9
        ctx.fillStyle = gradientOf(ctx, p, W, H, 'd')
        ctx.fillRect(0, 0, W, H)
        ctx.restore()
      }
      break
    }
  }

  // A touch of grain on every paper so it never reads as flat vector fill.
  paintGrain(ctx, W, H, scale)

  if (theme.deckle) paintDeckle(ctx, W, H, theme)
}

/** A 4-point sparkle. */
function drawSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.beginPath()
  ctx.moveTo(x, y - s)
  ctx.quadraticCurveTo(x + s * 0.18, y - s * 0.18, x + s, y)
  ctx.quadraticCurveTo(x + s * 0.18, y + s * 0.18, x, y + s)
  ctx.quadraticCurveTo(x - s * 0.18, y + s * 0.18, x - s, y)
  ctx.quadraticCurveTo(x - s * 0.18, y - s * 0.18, x, y - s)
  ctx.fill()
}

/** Fine paper grain via sparse alpha-noise dots. */
function paintGrain(ctx: CanvasRenderingContext2D, W: number, H: number, scale: number): void {
  const step = Math.max(2, Math.round(3 / Math.max(scale, 0.5)))
  const rnd = createRandom(0x5eed)
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.035)'
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      if (rnd() > 0.66) ctx.fillRect(x, y, 1, 1)
    }
  }
  ctx.restore()
}

/** A gently uneven, aged edge around the sheet. */
function paintDeckle(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  theme: PaperTheme,
): void {
  ctx.save()
  ctx.strokeStyle = theme.frameStroke
  ctx.lineWidth = Math.max(1, W * 0.004)
  ctx.globalAlpha = 0.75
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth)
  ctx.restore()
}
