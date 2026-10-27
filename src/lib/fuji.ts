/**
 * Fujifilm film simulation engine.
 *
 * A compact, pixel-accurate re-implementation of Fujifilm's film simulation
 * looks, derived from the openly documented characteristics used by
 * `hulk-2019/FujiSim` (a programmatic Fuji colour engine) and the recipe data
 * catalogued by `matthieurobin/open-fuji-recipes`.
 *
 * Pipeline order (mirrors FujiSim's `process_image`):
 *   1. per-channel tone curves   → contrast + the simulation's colour bias
 *   2. split toning              → warm highlights / cool shadows (or inverse)
 *   3. per-channel shift         → global hue leaning
 *   4. saturation (anchored on luminance, never shifts neutral greys)
 *   5. fade                      → milky low-contrast base (Eterna / Classic Neg)
 *   6. monochrome                → Acros / Monochrome with filter tints
 *   7. grain                     → luminance-masked film grain
 *
 * Two representations are produced from one source of truth:
 *   - `applySimulationToCanvas` for the exported print (real per-pixel maths)
 *   - `simulationToCss`          for instand CSS preview in the viewfinder
 *     (approximated with CSS filter functions, which is what genuinely runs
 *     at 60fps on a live <video>)
 */

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type SimId =
  | 'provia'
  | 'velvia'
  | 'astia'
  | 'classic-chrome'
  | 'pro-neg-std'
  | 'pro-neg-hi'
  | 'eterna'
  | 'classic-neg'
  | 'nostalgic-neg'
  | 'acros'
  | 'acros-y'
  | 'acros-r'
  | 'monochrome'
  | 'none'

/** A Fujifilm film simulation recipe. */
export interface Simulation {
  id: SimId
  /** Display name (the real Fuji designation). */
  name: string
  /** One-line Chinese description of the look. */
  blurb: string
  /** Accent colour used by the picker swatch. */
  swatch: string
  /** Per-channel tone-curve bend. Positive lifts midtones of that channel. */
  rTilt: number
  gTilt: number
  bTilt: number
  /** Tone-curve S-shape strength, −1..1. */
  contrast: number
  /** Base saturation offset, −1..1. */
  saturation: number
  redShift: number
  greenShift: number
  blueShift: number
  /** Amount of milky grey washed into the whole frame, 0..1. */
  fade: number
  /** Split-toning multipliers for highlights. */
  splitHighlight: [number, number, number]
  /** Split-toning multipliers for shadows. */
  splitShadow: [number, number, number]
  /** Render as black & white. */
  monochrome: boolean
  /** Monochrome channel tint (simulates a coloured contrast filter). */
  monoTint: [number, number, number]
  /** Grain strength, 0..1. */
  grain: number
  /**
   * CSS approximation used for the live viewfinder preview.
   * Hand-tuned so the on-screen preview is close to the exported result.
   */
  css: string
}

/* -------------------------------------------------------------------------- */
/* Recipes                                                                    */
/* -------------------------------------------------------------------------- */

const NEUTRAL: Omit<Simulation, 'id' | 'name' | 'blurb' | 'swatch' | 'css'> = {
  rTilt: 0,
  gTilt: 0,
  bTilt: 0,
  contrast: 0,
  saturation: 0,
  redShift: 0,
  greenShift: 0,
  blueShift: 0,
  fade: 0,
  splitHighlight: [1, 1, 1],
  splitShadow: [1, 1, 1],
  monochrome: false,
  monoTint: [1, 1, 1],
  grain: 0,
}

/** All built-in simulations, in Fuji's own menu order. */
export const SIMULATIONS: Simulation[] = [
  {
    ...NEUTRAL,
    id: 'provia',
    name: 'PROVIA',
    blurb: '标准 · 忠实还原',
    swatch: '#c8b89a',
    contrast: 0.15,
    saturation: 0.1,
    rTilt: 0.02,
    bTilt: -0.02,
    splitHighlight: [1.02, 1.0, 0.98],
    splitShadow: [0.98, 1.0, 1.02],
    grain: 0.1,
    css: 'saturate(1.08) contrast(1.06)',
  },
  {
    ...NEUTRAL,
    id: 'velvia',
    name: 'VELVIA',
    blurb: '浓郁 · 风景之王',
    swatch: '#2f6b48',
    contrast: 0.35,
    saturation: 0.55,
    rTilt: 0.08,
    gTilt: 0.04,
    bTilt: -0.05,
    redShift: 0.06,
    greenShift: 0.05,
    blueShift: -0.04,
    splitHighlight: [1.06, 1.02, 0.96],
    splitShadow: [1.02, 1.0, 0.94],
    grain: 0.08,
    css: 'saturate(1.62) contrast(1.2)',
  },
  {
    ...NEUTRAL,
    id: 'astia',
    name: 'ASTIA',
    blurb: '柔和 · 人像肤色',
    swatch: '#d9a08c',
    contrast: 0.05,
    saturation: -0.05,
    rTilt: 0.03,
    redShift: 0.02,
    splitHighlight: [1.03, 1.0, 0.97],
    splitShadow: [1.0, 1.0, 1.02],
    grain: 0.1,
    css: 'saturate(0.98) contrast(1.02) brightness(1.03)',
  },
  {
    ...NEUTRAL,
    id: 'classic-chrome',
    name: 'CLASSIC CHROME',
    blurb: '纪实 · 低饱和冷调',
    swatch: '#7a8494',
    contrast: 0.25,
    saturation: -0.2,
    rTilt: -0.02,
    bTilt: 0.05,
    redShift: -0.05,
    blueShift: 0.06,
    fade: 0.12,
    splitHighlight: [0.96, 0.98, 1.04],
    splitShadow: [0.94, 0.96, 1.06],
    grain: 0.16,
    css: 'saturate(0.72) contrast(1.1) sepia(0.08) hue-rotate(-6deg)',
  },
  {
    ...NEUTRAL,
    id: 'pro-neg-std',
    name: 'PRO NEG STD',
    blurb: '专业负片 · 平实',
    swatch: '#9c8f7a',
    contrast: -0.1,
    saturation: -0.15,
    rTilt: 0.01,
    grain: 0.14,
    css: 'saturate(0.85) contrast(0.95)',
  },
  {
    ...NEUTRAL,
    id: 'pro-neg-hi',
    name: 'PRO NEG HI',
    blurb: '专业负片 · 硬调',
    swatch: '#a8907a',
    contrast: 0.1,
    saturation: -0.05,
    rTilt: 0.02,
    grain: 0.14,
    css: 'saturate(0.94) contrast(1.08)',
  },
  {
    ...NEUTRAL,
    id: 'eterna',
    name: 'ETERNA',
    blurb: '电影 · 奶油低反差',
    swatch: '#8d9a8e',
    contrast: -0.2,
    saturation: -0.3,
    rTilt: -0.02,
    gTilt: 0.01,
    bTilt: 0.03,
    fade: 0.18,
    splitHighlight: [0.96, 1.0, 1.04],
    splitShadow: [1.02, 1.0, 0.96],
    grain: 0.18,
    css: 'saturate(0.66) contrast(0.86) brightness(1.06) sepia(0.06)',
  },
  {
    ...NEUTRAL,
    id: 'classic-neg',
    name: 'CLASSIC NEG',
    blurb: '经典负片 · 复古浓郁',
    swatch: '#b07a4e',
    contrast: 0.3,
    saturation: 0.05,
    rTilt: 0.05,
    gTilt: -0.03,
    bTilt: 0.04,
    redShift: 0.04,
    greenShift: -0.06,
    blueShift: 0.05,
    fade: 0.08,
    splitHighlight: [1.04, 0.96, 0.98],
    splitShadow: [0.92, 0.96, 1.05],
    grain: 0.2,
    css: 'saturate(1.1) contrast(1.16) sepia(0.1) hue-rotate(-4deg)',
  },
  {
    ...NEUTRAL,
    id: 'nostalgic-neg',
    name: 'NOSTALGIC NEG',
    blurb: '怀旧负片 · 琥珀暖调',
    swatch: '#cf9a63',
    contrast: 0.1,
    rTilt: 0.04,
    gTilt: -0.01,
    bTilt: -0.03,
    redShift: 0.05,
    blueShift: -0.04,
    fade: 0.16,
    splitHighlight: [1.05, 1.0, 0.94],
    splitShadow: [1.02, 0.98, 0.92],
    grain: 0.2,
    css: 'sepia(0.22) saturate(1.1) contrast(1.04) brightness(1.04)',
  },
  {
    ...NEUTRAL,
    id: 'acros',
    name: 'ACROS',
    blurb: '黑白 · 细腻灰阶',
    swatch: '#6e6e6e',
    contrast: 0.3,
    monochrome: true,
    monoTint: [1, 1, 1],
    grain: 0.3,
    css: 'grayscale(1) contrast(1.22)',
  },
  {
    ...NEUTRAL,
    id: 'acros-y',
    name: 'ACROS + Ye',
    blurb: '黑白 · 黄滤片',
    swatch: '#7d7a63',
    contrast: 0.3,
    monochrome: true,
    monoTint: [1.1, 1.0, 0.85],
    grain: 0.3,
    css: 'grayscale(1) contrast(1.26) sepia(0.16)',
  },
  {
    ...NEUTRAL,
    id: 'acros-r',
    name: 'ACROS + R',
    blurb: '黑白 · 红滤片',
    swatch: '#6f5a55',
    contrast: 0.35,
    monochrome: true,
    monoTint: [1.3, 0.9, 0.7],
    grain: 0.32,
    css: 'grayscale(1) contrast(1.35) sepia(0.3) saturate(1.4)',
  },
  {
    ...NEUTRAL,
    id: 'monochrome',
    name: 'MONOCHROME',
    blurb: '黑白 · 中性',
    swatch: '#8a8a8a',
    contrast: 0.15,
    monochrome: true,
    monoTint: [1, 1, 1],
    grain: 0.26,
    css: 'grayscale(1) contrast(1.1)',
  },
  {
    ...NEUTRAL,
    id: 'none',
    name: 'ORIGINAL',
    blurb: '原图 · 不做处理',
    swatch: '#c9bfae',
    grain: 0,
    css: 'none',
  },
]

/** Fast lookup by id. */
export const SIM_BY_ID: Record<SimId, Simulation> = SIMULATIONS.reduce(
  (acc, s) => {
    acc[s.id] = s
    return acc
  },
  {} as Record<SimId, Simulation>,
)

/** Default simulation — Fuji's own default body setting. */
export const DEFAULT_SIM: SimId = 'provia'

/** Resolve a simulation, degrading gracefully to the default. */
export function getSim(id: SimId | string): Simulation {
  const found = SIM_BY_ID[id as SimId]
  return found ?? SIM_BY_ID[DEFAULT_SIM]
}

/** CSS `filter` value for the live viewfinder preview. */
export function simulationToCss(id: SimId | string): string {
  return getSim(id).css
}

/* -------------------------------------------------------------------------- */
/* Lens effects                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Optical effects, modelled on the Instax mini Evo's ten lens effects.
 *
 * These are *lens* treatments, distinct from film simulations: the simulation
 * decides colour character, the lens effect decides how the optics behave
 * (vignetting, softness, distortion, light leaks).
 */
export interface LensEffect {
  id: string
  name: string
  /** CSS filter string applied over the simulation. */
  css: string
  /** Extra canvas pass, if the effect needs more than a filter. */
  pass?: 'vignette' | 'lightleak' | 'soft' | 'fisheye' | 'double' | 'half'
}

export const LENS_EFFECTS: LensEffect[] = [
  { id: 'normal', name: '标准', css: 'none' },
  { id: 'vignette', name: '暗角', css: 'contrast(1.06) brightness(0.98)', pass: 'vignette' },
  { id: 'soft', name: '柔焦', css: 'blur(0.6px) brightness(1.04) saturate(1.05)', pass: 'soft' },
  { id: 'blur', name: '模糊', css: 'blur(1.2px)' },
  { id: 'fisheye', name: '鱼眼', css: 'saturate(1.1) contrast(1.05)', pass: 'fisheye' },
  { id: 'shift', name: '色散', css: 'saturate(1.15) contrast(1.08) hue-rotate(3deg)' },
  { id: 'leak', name: '漏光', css: 'sepia(0.18) brightness(1.1) saturate(1.2)', pass: 'lightleak' },
  { id: 'mirror', name: '镜像', css: 'saturate(1.05)' },
  { id: 'double', name: '重曝', css: 'contrast(1.1) brightness(1.05)', pass: 'double' },
  { id: 'half', name: '半格', css: 'contrast(1.04)', pass: 'half' },
]

export const LENS_BY_ID: Record<string, LensEffect> = LENS_EFFECTS.reduce<Record<string, LensEffect>>(
  (acc, e) => {
    acc[e.id] = e
    return acc
  },
  {},
)

/** CSS for a lens effect id, safe for unknown ids. */
export function lensToCss(id: string | undefined): string {
  if (!id) return 'none'
  return LENS_BY_ID[id]?.css ?? 'none'
}

/** Combine a film simulation and a lens effect into one CSS filter string. */
export function combinedCss(simId: SimId | string, lensId?: string): string {
  const a = simulationToCss(simId)
  const b = lensToCss(lensId)
  if (a === 'none' && b === 'none') return 'none'
  if (a === 'none') return b
  if (b === 'none') return a
  return `${a} ${b}`
}

/* -------------------------------------------------------------------------- */
/* Tone curve (baked to a LUT for speed)                                      */
/* -------------------------------------------------------------------------- */

const LUT_SIZE = 256

/**
 * Build a 256-entry tone curve combining contrast, highlight and shadow
 * shaping — the same construction FujiSim uses.
 */
function buildCurve(contrast: number): Float32Array {
  const lut = new Float32Array(LUT_SIZE)
  const c = Math.max(-1, Math.min(1, contrast))
  for (let i = 0; i < LUT_SIZE; i += 1) {
    const x = i / (LUT_SIZE - 1)
    let y = x
    // Positive contrast: bend the line into an S, steepening the midtones.
    const sCurve = (Math.tanh((x - 0.5) * 2) / Math.tanh(1)) * 0.5 + 0.5
    if (c > 0) y = y + (sCurve - y) * (c * 0.6)
    // Negative contrast: pull the whole line toward a flatter, softer ramp.
    else if (c < 0) y = 0.18 + (y - 0.18) * (1 - -c * 0.55)
    lut[i] = Math.max(0, Math.min(1, y))
  }
  return lut
}

/** Apply a baked LUT with linear interpolation between entries. */
function applyLut(lut: Float32Array, v: number): number {
  const x = v <= 0 ? 0 : v >= 1 ? 1 : v
  const pos = x * (LUT_SIZE - 1)
  const idx = pos | 0
  if (idx >= LUT_SIZE - 1) return lut[LUT_SIZE - 1] as number
  const a = lut[idx] as number
  const b = lut[idx + 1] as number
  return a + (b - a) * (pos - idx)
}

/**
 * Bend one channel around the middle.
 *
 * `x + tilt · x(1−x) · 1.6` is zero at both ends and maximal mid-range, so
 * pure black and pure white never drift off-colour.
 */
function bendChannel(
  base: Float32Array,
  tilt: number,
): (v: number) => number {
  if (tilt === 0) return (v) => applyLut(base, v)
  return (v) => applyLut(base, Math.max(0, Math.min(1, v + tilt * v * (1 - v) * 1.6)))
}

/* -------------------------------------------------------------------------- */
/* Canvas application                                                         */
/* -------------------------------------------------------------------------- */

/**
 * A seeded value-noise generator, so the grain is stable per image rather
 * than shimmering on every re-render.
 */
function makeNoise(seed: number): () => number {
  let s = seed >>> 0 || 0x9e3779b9
  return () => {
    s = (Math.imul(s ^ (s >>> 15), s | 1) + 0x6d2b79f5) >>> 0
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61)
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296
  }
}

export interface ApplyOptions {
  /** Grain seed — keep it stable between re-renders of the same photo. */
  seed?: number
  /** 0..1 overall strength, for blending "before/after" in the UI. */
  strength?: number
}

/**
 * Apply a film simulation to the pixels of a canvas, in place.
 *
 * This is the real per-pixel implementation; the CSS strings above are only
 * for live previews. Runs on the main thread but is fast enough for the
 * single-strip use case (~2MP in a few tens of ms).
 */
export function applySimulationToCanvas(
  canvas: HTMLCanvasElement,
  simId: SimId | string,
  options: ApplyOptions = {},
): void {
  const sim = getSim(simId)
  if (sim.id === 'none') return

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  const { width, height } = canvas
  if (width === 0 || height === 0) return

  let image: ImageData
  try {
    image = ctx.getImageData(0, 0, width, height)
  } catch {
    // Tainted canvas (cross-origin image) — nothing we can do.
    return
  }
  const data = image.data

  const strength = options.strength ?? 1
  const grain = sim.grain * strength
  const noise = makeNoise(options.seed ?? 0x1234)
  const curve = buildCurve(sim.contrast * strength)
  const rCurve = bendChannel(curve, sim.rTilt * strength)
  const gCurve = bendChannel(curve, sim.gTilt * strength)
  const bCurve = bendChannel(curve, sim.bTilt * strength)

  const [shR, shG, shB] = sim.splitHighlight
  const [sdR, sdG, sdB] = sim.splitShadow
  const fade = sim.fade * strength
  const satAmount = 1 + sim.saturation * strength

  for (let i = 0; i < data.length; i += 4) {
    // --- to 0..1 ---------------------------------------------------------
    let r = (data[i] as number) / 255
    let g = (data[i + 1] as number) / 255
    let b = (data[i + 2] as number) / 255
    const origR = r
    const origG = g
    const origB = b

    // --- [1] per-channel tone curves ------------------------------------
    r = rCurve(r)
    g = gCurve(g)
    b = bCurve(b)

    // --- [2] split toning -----------------------------------------------
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    const hi = Math.max(0, lum - 0.5) * 2
    const sh = Math.max(0, 0.5 - lum) * 2
    r *= 1 + (shR - 1) * hi * strength
    g *= 1 + (shG - 1) * hi * strength
    b *= 1 + (shB - 1) * hi * strength
    r *= 1 + (sdR - 1) * sh * strength
    g *= 1 + (sdG - 1) * sh * strength
    b *= 1 + (sdB - 1) * sh * strength

    // --- [3] global channel shifts ---------------------------------------
    r += sim.redShift * 0.05 * strength
    g += sim.greenShift * 0.05 * strength
    b += sim.blueShift * 0.05 * strength

    // --- [4] luminance-anchored saturation -------------------------------
    if (satAmount !== 1) {
      const l2 = 0.2126 * r + 0.7152 * g + 0.0722 * b
      r = l2 + (r - l2) * satAmount
      g = l2 + (g - l2) * satAmount
      b = l2 + (b - l2) * satAmount
    }

    // --- [5] fade toward a milky base ------------------------------------
    if (fade > 0) {
      r = r * (1 - fade) + 0.08 * fade
      g = g * (1 - fade) + 0.08 * fade
      b = b * (1 - fade) + 0.1 * fade
    }

    // --- [6] monochrome ---------------------------------------------------
    if (sim.monochrome) {
      const y = 0.299 * r + 0.587 * g + 0.114 * b
      const [tR, tG, tB] = sim.monoTint
      r = y * (1 + (tR - 1) * strength)
      g = y * (1 + (tG - 1) * strength)
      b = y * (1 + (tB - 1) * strength)
    }

    // --- [7] grain, strongest in the midtones ----------------------------
    if (grain > 0) {
      const gl = 0.2126 * r + 0.7152 * g + 0.0722 * b
      const mask = 1 - Math.abs(gl - 0.5) * 2 // 1 at mid-grey, 0 at extremes
      const n = (noise() - 0.5) * grain * 0.16 * mask
      r += n
      g += n
      b += n
    }

    // --- blend with the original for `strength` ---------------------------
    if (strength < 1) {
      r = origR + (r - origR) * strength
      g = origG + (g - origG) * strength
      b = origB + (b - origB) * strength
    }

    data[i] = Math.max(0, Math.min(255, r * 255)) | 0
    data[i + 1] = Math.max(0, Math.min(255, g * 255)) | 0
    data[i + 2] = Math.max(0, Math.min(255, b * 255)) | 0
    // alpha (data[i + 3]) is untouched
  }

  ctx.putImageData(image, 0, 0)
}

/**
 * Filter an arbitrary `<img>`/`HTMLCanvasElement` source into a new canvas
 * with a simulation applied. Returns a canvas ready to be drawn.
 */
export function simulationToCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
  simId: SimId | string,
  options: ApplyOptions = {},
): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(width))
  out.height = Math.max(1, Math.round(height))
  const ctx = out.getContext('2d', { willReadFrequently: true })
  if (ctx) {
    ctx.drawImage(source, 0, 0, out.width, out.height)
    applySimulationToCanvas(out, simId, options)
  }
  return out
}
