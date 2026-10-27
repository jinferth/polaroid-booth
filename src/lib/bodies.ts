/**
 * Camera body designs.
 *
 * Each entry is a complete visual identity for the instant camera: the colour
 * of every moulded part, plus the default film simulation that body "shoots
 * with" — the way a real body has its own colour character.
 *
 * The colours map 1:1 onto the CSS custom properties consumed by
 * `camera-shell.css`, so adding a body is pure data: no CSS edits required.
 */

import type { SimId } from './fuji'

/** Every colour a camera body needs. Mirrors the CSS variables. */
export interface BodyColors {
  /** Top plate — the brightest metal or plastic. */
  plateHi: string
  /** Top plate mid-tone. */
  plate: string
  /** Top plate shadow side. */
  plateLo: string
  /** Upper body / lens barrel dark tone. */
  bodyHi: string
  /** Lower body — the main "leatherette" area. */
  body: string
  /** Deepest shadow of the body. */
  bodyLo: string
  /** Accent colour: LED, dial pointer, decorative marks. */
  accent: string
  /** Outline / ink colour for every hard edge. */
  ink: string
  /** Frame colour of the lens glass rim. */
  lensRim: string
  /** Material finish, which drives a highlight treatment. */
  finish: 'metal' | 'gloss' | 'matte' | 'transparent'
}

/** A selectable camera body. */
export interface CameraBody {
  id: string
  /** Chinese display name. */
  name: string
  /** One-line character note shown under the name. */
  blurb: string
  /** The film simulation this body shoots with by default. */
  defaultSim: SimId
  /** Full colour set. */
  colors: BodyColors
  /** A short CSS gradient for the swatch in the picker. */
  swatch: string
  /** Body shape family — affects proportions and detailing. */
  shape: CameraShape
  /** The real camera this body is modelled on, shown as provenance. */
  lineage?: string
}

/**
 * Structural families.
 *
 * These are genuinely different machines, not colour variants: the body
 * proportions, where the lens sits, what controls exist, and how the print
 * leaves the camera all differ. This is the difference between a reskin and a
 * different camera.
 *
 *  - `mini`    — Instax Mini 12: rounded, twist-to-power lens, offset finder.
 *  - `evo`     — Instax Mini Evo: boxy retro, two dials (lens + film), top
 *                print lever, large front plate.
 *  - `sx70`    — Polaroid SX-70: long folding body, twin top wheels, chrome
 *                and leather, flash bar slot across the top.
 *  - `onestep` — Polaroid OneStep 600: square body, rainbow stripe, big centred
 *                lens, print exits the front.
 *  - `rangefinder` — the Fuji X100-style body the app started with.
 *  - `bubble`  — a soft rounded consumer body.
 *  - `boxy`    — a squared-off consumer body.
 */
export type CameraShape = 'rangefinder' | 'mini' | 'evo' | 'sx70' | 'onestep' | 'bubble' | 'boxy'

/* -------------------------------------------------------------------------- */
/* Palette helpers                                                            */
/* -------------------------------------------------------------------------- */

const metal = (hi: string, mid: string, lo: string) => ({ hi, mid, lo })

/** Standard silver plate, reused by several bodies. */
const SILVER = metal('#f2f2ef', '#d8d8d2', '#a9a89f')

/* -------------------------------------------------------------------------- */
/* Bodies                                                                     */
/* -------------------------------------------------------------------------- */

export const CAMERA_BODIES: CameraBody[] = [
  /* ====================================================================== */
  /* Structural families — each a different machine, not a reskin           */
  /* ====================================================================== */
  {
    id: 'mini-mint',
    name: 'Mini 薄荷',
    blurb: '圆润小机身，扭转镜头开关机',
    lineage: 'Instax Mini 12',
    defaultSim: 'astia',
    shape: 'mini',
    colors: {
      plateHi: '#f4fdf8',
      plate: '#dcf5e8',
      plateLo: '#b2e0cb',
      bodyHi: '#a6dcc2',
      body: '#82c4a5',
      bodyLo: '#5fa585',
      accent: '#2d8a63',
      ink: '#1d4234',
      lensRim: '#4d8672',
      finish: 'gloss',
    },
    swatch: 'linear-gradient(180deg, #dcf5e8 0 40%, #82c4a5 40% 100%)',
  },
  {
    id: 'mini-pink',
    name: 'Mini 樱粉',
    blurb: '圆润小机身，扭转镜头开关机',
    lineage: 'Instax Mini 12',
    defaultSim: 'astia',
    shape: 'mini',
    colors: {
      plateHi: '#fff6f9',
      plate: '#fcdde8',
      plateLo: '#efb6c8',
      bodyHi: '#e8a0b6',
      body: '#d7809c',
      bodyLo: '#b25f7d',
      accent: '#bd3a63',
      ink: '#4a2a36',
      lensRim: '#8a5468',
      finish: 'gloss',
    },
    swatch: 'linear-gradient(180deg, #fcdde8 0 40%, #d7809c 40% 100%)',
  },
  {
    id: 'evo-black',
    name: 'Evo 黑',
    blurb: '双拨盘复古，镜头 × 胶片自由组合',
    lineage: 'Instax Mini Evo',
    defaultSim: 'classic-chrome',
    shape: 'evo',
    colors: {
      plateHi: '#4a4a4e',
      plate: '#33333a',
      plateLo: '#232329',
      bodyHi: '#2c2c31',
      body: '#1e1e23',
      bodyLo: '#141418',
      accent: '#d8b46a',
      ink: '#08080a',
      lensRim: '#5a5a60',
      finish: 'metal',
    },
    swatch: 'linear-gradient(180deg, #33333a 0 40%, #1e1e23 40% 100%)',
  },
  {
    id: 'evo-brown',
    name: 'Evo 棕',
    blurb: '双拨盘复古，镜头 × 胶片自由组合',
    lineage: 'Instax Mini Evo',
    defaultSim: 'classic-neg',
    shape: 'evo',
    colors: {
      plateHi: '#e8dcc8',
      plate: '#cdb896',
      plateLo: '#a08a66',
      bodyHi: '#6b5240',
      body: '#4e3a2c',
      bodyLo: '#382a20',
      accent: '#d8b46a',
      ink: '#1a120c',
      lensRim: '#6b5847',
      finish: 'metal',
    },
    swatch: 'linear-gradient(180deg, #cdb896 0 40%, #4e3a2c 40% 100%)',
  },
  {
    id: 'sx70-chrome',
    name: 'SX-70 铬',
    blurb: '折叠机身，顶部双调轮',
    lineage: 'Polaroid SX-70',
    defaultSim: 'nostalgic-neg',
    shape: 'sx70',
    colors: {
      plateHi: '#f6f6f2',
      plate: '#dcdcd4',
      plateLo: '#a8a8a0',
      bodyHi: '#8a6f4e',
      body: '#6b5338',
      bodyLo: '#4a3a27',
      accent: '#c8a24a',
      ink: '#141210',
      lensRim: '#5a5a54',
      finish: 'metal',
    },
    swatch: 'linear-gradient(180deg, #dcdcd4 0 42%, #6b5338 42% 100%)',
  },
  {
    id: 'sx70-white',
    name: 'SX-70 白',
    blurb: '折叠机身，顶部双调轮',
    lineage: 'Polaroid SX-70 Model 2',
    defaultSim: 'provia',
    shape: 'sx70',
    colors: {
      plateHi: '#fffdf8',
      plate: '#f2ece0',
      plateLo: '#d8cfbc',
      bodyHi: '#8a6f4e',
      body: '#6b5338',
      bodyLo: '#4a3a27',
      accent: '#b8903e',
      ink: '#2a241c',
      lensRim: '#8a7f6a',
      finish: 'gloss',
    },
    swatch: 'linear-gradient(180deg, #f2ece0 0 42%, #6b5338 42% 100%)',
  },
  {
    id: 'onestep-rainbow',
    name: 'OneStep 彩虹',
    blurb: '方块机身，经典彩虹条纹',
    lineage: 'Polaroid OneStep 600',
    defaultSim: 'velvia',
    shape: 'onestep',
    colors: {
      plateHi: '#f8f8f4',
      plate: '#e4e4dc',
      plateLo: '#b8b8b0',
      bodyHi: '#3a3a3e',
      body: '#26262a',
      bodyLo: '#18181b',
      accent: '#d0342c',
      ink: '#0e0e10',
      lensRim: '#4a4a4e',
      finish: 'matte',
    },
    swatch:
      'linear-gradient(90deg, #d0342c 0 16%, #e8892c 16% 32%, #e8c92c 32% 48%, #4fa84a 48% 64%, #3a7fc4 64% 80%, #7a4fb0 80% 100%)',
  },
  {
    id: 'onestep-classic',
    name: 'OneStep 经典',
    blurb: '方块机身，经典彩虹条纹',
    lineage: 'Polaroid OneStep 600',
    defaultSim: 'provia',
    shape: 'onestep',
    colors: {
      plateHi: '#fffdf6',
      plate: '#f4efe2',
      plateLo: '#d6cdb8',
      bodyHi: '#4a4a48',
      body: '#35352f',
      bodyLo: '#232320',
      accent: '#c88a3a',
      ink: '#12120f',
      lensRim: '#5a5a54',
      finish: 'matte',
    },
    swatch:
      'linear-gradient(90deg, #c85a3a 0 16%, #d88a3a 16% 32%, #d8c04a 32% 48%, #6a9a4a 48% 64%, #4a7fa8 64% 80%, #7a5a9a 80% 100%)',
  },

  /* ====================================================================== */
  /* Rangefinder family — the original X100-style body                      */
  /* ====================================================================== */
  {
    id: 'classic-silver',
    name: '经典银黑',
    blurb: '银顶盖 + 黑皮革，最像富士',
    lineage: 'Fujifilm X100',
    defaultSim: 'provia',
    shape: 'rangefinder',
    colors: {
      plateHi: SILVER.hi,
      plate: SILVER.mid,
      plateLo: SILVER.lo,
      bodyHi: '#26262a',
      body: '#1c1c1f',
      bodyLo: '#17171a',
      accent: '#d0342c',
      ink: '#0e0e10',
      lensRim: '#4a4a4d',
      finish: 'metal',
    },
    swatch: 'linear-gradient(180deg, #d8d8d2 0 38%, #1c1c1f 38% 100%)',
  },
  {
    id: 'all-black',
    name: '全黑战损',
    blurb: '通体哑黑，低调耐看',
    defaultSim: 'acros',
    shape: 'rangefinder',
    colors: {
      plateHi: '#3a3a3e',
      plate: '#2a2a2e',
      plateLo: '#1d1d21',
      bodyHi: '#242428',
      body: '#18181b',
      bodyLo: '#101012',
      accent: '#e8503a',
      ink: '#08080a',
      lensRim: '#3a3a3d',
      finish: 'matte',
    },
    swatch: 'linear-gradient(180deg, #2a2a2e 0 38%, #18181b 38% 100%)',
  },
  {
    id: 'cream-white',
    name: '奶油白',
    blurb: '奶白机身，温柔干净',
    defaultSim: 'astia',
    shape: 'bubble',
    colors: {
      plateHi: '#fffdf8',
      plate: '#f4ecdd',
      plateLo: '#ddcfb6',
      bodyHi: '#e8dcc6',
      body: '#d3c3a6',
      bodyLo: '#b5a284',
      accent: '#c08a3e',
      ink: '#3a3128',
      lensRim: '#7d6f5c',
      finish: 'gloss',
    },
    swatch: 'linear-gradient(180deg, #f4ecdd 0 38%, #d3c3a6 38% 100%)',
  },
  {
    id: 'sakura-pink',
    name: '樱粉',
    blurb: '少女感樱花粉',
    defaultSim: 'astia',
    shape: 'bubble',
    colors: {
      // Bright plate over a deeper rose body so the two-tone split reads.
      plateHi: '#fff5f8',
      plate: '#fbdce6',
      plateLo: '#e8b3c4',
      bodyHi: '#e79cb2',
      body: '#d97f9c',
      bodyLo: '#b95f80',
      accent: '#c23a62',
      ink: '#4d2b36',
      lensRim: '#8a5468',
      finish: 'gloss',
    },
    swatch: 'linear-gradient(180deg, #fbdce6 0 38%, #d97f9c 38% 100%)',
  },
  {
    id: 'mint',
    name: '薄荷绿',
    blurb: '清爽复古薄荷',
    defaultSim: 'classic-chrome',
    shape: 'bubble',
    colors: {
      plateHi: '#f2fbf5',
      plate: '#d6f0e2',
      plateLo: '#aedcc6',
      bodyHi: '#9fd4b8',
      body: '#7dbb9c',
      bodyLo: '#5c9a7d',
      accent: '#2f7a58',
      ink: '#1e3a2d',
      lensRim: '#4a7a62',
      finish: 'gloss',
    },
    swatch: 'linear-gradient(180deg, #d6f0e2 0 38%, #7dbb9c 38% 100%)',
  },
  {
    id: 'butter',
    name: '奶油黄',
    blurb: '复古奶油黄，暖到发光',
    defaultSim: 'nostalgic-neg',
    shape: 'boxy',
    colors: {
      plateHi: '#fffbe4',
      plate: '#fbe9b4',
      plateLo: '#e0c882',
      bodyHi: '#eed88f',
      body: '#d9be69',
      bodyLo: '#b99c4a',
      accent: '#b87617',
      ink: '#453317',
      lensRim: '#7d6934',
      finish: 'gloss',
    },
    swatch: 'linear-gradient(180deg, #fbe9b4 0 38%, #d9be69 38% 100%)',
  },
  {
    id: 'transparent',
    name: '透明壳',
    blurb: '半透明外壳，看得见内部',
    defaultSim: 'eterna',
    shape: 'boxy',
    colors: {
      plateHi: '#f8fbff',
      plate: '#dde8f3',
      plateLo: '#b0c2d5',
      bodyHi: '#c3d5e6',
      body: '#a3bcd2',
      bodyLo: '#7f9cb6',
      accent: '#3d7ba8',
      ink: '#2c3a47',
      lensRim: '#5f7a92',
      finish: 'transparent',
    },
    swatch:
      'linear-gradient(160deg, rgba(248,251,255,0.95) 0%, rgba(163,188,210,0.92) 60%, rgba(127,156,182,0.92) 100%)',
  },
  {
    id: 'olive',
    name: '军绿',
    blurb: '老式军用橄榄绿',
    defaultSim: 'classic-neg',
    shape: 'boxy',
    colors: {
      plateHi: '#a8a88a',
      plate: '#8c8c6f',
      plateLo: '#6b6b52',
      bodyHi: '#8a8a6d',
      body: '#6f6f56',
      bodyLo: '#52523f',
      accent: '#c2703a',
      ink: '#20201a',
      lensRim: '#5a5a46',
      finish: 'matte',
    },
    swatch: 'linear-gradient(180deg, #8c8c6f 0 38%, #6f6f56 38% 100%)',
  },
  {
    id: 'burgundy',
    name: '酒红皮革',
    blurb: '酒红皮革 + 金边',
    defaultSim: 'velvia',
    shape: 'rangefinder',
    colors: {
      plateHi: '#e8d9b8',
      plate: '#d4c193',
      plateLo: '#a8925f',
      bodyHi: '#7d2a35',
      body: '#5f1f28',
      bodyLo: '#43151c',
      accent: '#d4a94a',
      ink: '#1a0b0e',
      lensRim: '#6b3a40',
      finish: 'metal',
    },
    swatch: 'linear-gradient(180deg, #d4c193 0 38%, #5f1f28 38% 100%)',
  },
  {
    id: 'sky',
    name: '天空蓝',
    blurb: '淡天蓝，像夏天的下午',
    defaultSim: 'provia',
    shape: 'bubble',
    colors: {
      plateHi: '#f2faff',
      plate: '#d3e9fa',
      plateLo: '#a9cbe6',
      bodyHi: '#a5cde9',
      body: '#7fb3d6',
      bodyLo: '#5d92b6',
      accent: '#2c6d9e',
      ink: '#1f3446',
      lensRim: '#4f7891',
      finish: 'gloss',
    },
    swatch: 'linear-gradient(180deg, #d3e9fa 0 38%, #7fb3d6 38% 100%)',
  },
]

/** Fast lookup by id. */
export const BODY_BY_ID: Record<string, CameraBody> = CAMERA_BODIES.reduce<Record<string, CameraBody>>(
  (acc, b) => {
    acc[b.id] = b
    return acc
  },
  {},
)

/** The body used when nothing has been chosen yet. */
export const DEFAULT_BODY_ID = 'classic-silver'

/** Resolve a body, degrading gracefully. */
export function getBody(id: string | null | undefined): CameraBody {
  if (id) {
    const found = BODY_BY_ID[id]
    if (found) return found
  }
  return BODY_BY_ID[DEFAULT_BODY_ID] as CameraBody
}

/** Relative luminance (0..1) of a `#rrggbb` colour. */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m || !m[1]) return 0.5
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Turn a body's colours into the CSS custom properties the stylesheet reads.
 *
 * Returning a plain object (rather than mutating a stylesheet) keeps the
 * component declarative and lets React diff it cheaply.
 *
 * The brand-plate ink is derived rather than declared: a light body gets dark
 * engraving, a dark body gets light engraving, so the logo never disappears.
 */
export function bodyToCssVars(body: CameraBody): Record<string, string> {
  const c = body.colors
  const brand = luminance(c.body) > 0.55 ? c.ink : '#f4f4ef'
  return {
    '--fuji-silver-hi': c.plateHi,
    '--fuji-silver': c.plate,
    '--fuji-silver-lo': c.plateLo,
    '--fuji-black': c.bodyHi,
    '--fuji-leather': c.body,
    '--fuji-black-lo': c.bodyLo,
    '--fuji-red': c.accent,
    '--fuji-ink': c.ink,
    '--fuji-lens-rim': c.lensRim,
    '--fuji-brand': brand,
  }
}
