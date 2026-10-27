import { describe, expect, it } from 'vitest'

import {
  CAPTION_FONT_STACK,
  computeCoverRect,
  DEFAULT_SHEET_WIDTH,
  DATE_FONT_STACK,
  measurePaper,
} from '../src/lib/polaroid'
import { STYLE_BY_ID } from '../src/lib/layouts'
import type { PhotoFrame } from '../src/lib/polaroid'

const photo = (w: number, h: number): PhotoFrame => ({
  image: {} as CanvasImageSource,
  width: w,
  height: h,
})

describe('computeCoverRect', () => {
  it('crops the sides when the source is wider than the destination', () => {
    // 2:1 source into a 1:1 destination → crop horizontally, keep full height.
    const r = computeCoverRect(200, 100, 100, 100)
    expect(r.sh).toBeCloseTo(100, 5)
    expect(r.sw).toBeCloseTo(100, 5)
    expect(r.sx).toBeCloseTo(50, 5) // centred
    expect(r.sy).toBeCloseTo(0, 5)
  })

  it('crops top/bottom when the source is taller than the destination', () => {
    // 1:2 source into 1:1 → crop vertically, keep full width.
    const r = computeCoverRect(100, 200, 100, 100)
    expect(r.sw).toBeCloseTo(100, 5)
    expect(r.sh).toBeCloseTo(100, 5)
    expect(r.sy).toBeCloseTo(50, 5)
    expect(r.sx).toBeCloseTo(0, 5)
  })

  it('is a no-op when aspects already match', () => {
    const r = computeCoverRect(400, 300, 200, 150)
    expect(r.sx).toBeCloseTo(0, 5)
    expect(r.sy).toBeCloseTo(0, 5)
    expect(r.sw).toBeCloseTo(400, 5)
    expect(r.sh).toBeCloseTo(300, 5)
  })

  it('always fills the destination exactly', () => {
    const cases: Array<[number, number, number, number]> = [
      [1920, 1080, 100, 100],
      [1080, 1920, 100, 100],
      [500, 500, 300, 100],
      [300, 800, 200, 200],
    ]
    for (const [sw, sh, dw, dh] of cases) {
      const r = computeCoverRect(sw, sh, dw, dh)
      expect(r.dw).toBeCloseTo(dw, 5)
      expect(r.dh).toBeCloseTo(dh, 5)
    }
  })

  it('survives zero and negative source dimensions', () => {
    const r = computeCoverRect(0, 0, 100, 100)
    expect(Number.isFinite(r.sw)).toBe(true)
    expect(Number.isFinite(r.sh)).toBe(true)
    expect(r.sw).toBeGreaterThan(0)
    expect(r.sh).toBeGreaterThan(0)
  })
})

describe('measurePaper', () => {
  it('returns a usable layout for every style', () => {
    for (const id of Object.keys(STYLE_BY_ID)) {
      const style = STYLE_BY_ID[id]!
      const layout = measurePaper(style, [photo(1200, 800)], 380)
      expect(layout.width).toBe(380)
      expect(layout.height).toBeGreaterThan(0)
      expect(layout.slots.length).toBeGreaterThan(0)
    }
  })

  it('handles an empty photo list without throwing', () => {
    const style = STYLE_BY_ID['rainbow-auto']!
    const layout = measurePaper(style, [], 380)
    expect(layout.height).toBeGreaterThan(0)
  })

  it('scales with the requested width', () => {
    const style = STYLE_BY_ID['rainbow-auto']!
    const a = measurePaper(style, [photo(1200, 800)], 200)
    const b = measurePaper(style, [photo(1200, 800)], 400)
    expect(b.height).toBeGreaterThan(a.height)
  })
})

describe('constants', () => {
  it('exposes a sane default sheet width', () => {
    expect(DEFAULT_SHEET_WIDTH).toBe(380)
  })

  it('uses handwriting and mono stacks for the captions', () => {
    expect(CAPTION_FONT_STACK).toContain('Caveat')
    expect(DATE_FONT_STACK.toLowerCase()).toContain('mono')
  })
})
