import { describe, expect, it } from 'vitest'

import {
  averageAspect,
  aspectOf,
  buildLayout,
  fitWindowInside,
  PAPER_STYLES,
  pickStyle,
  STYLE_BY_ID,
} from '../src/lib/layouts'
import type { PhotoFrame } from '../src/lib/polaroid'

/** A fake photo with the given aspect ratio. */
const photo = (aspect: number): PhotoFrame => ({
  image: {} as CanvasImageSource,
  width: Math.round(1000 * aspect),
  height: 1000,
})

const photos = (n: number, aspect = 1.5): PhotoFrame[] =>
  Array.from({ length: n }, () => photo(aspect))

describe('aspectOf', () => {
  it('returns the true aspect for a normal photo', () => {
    expect(aspectOf(photo(1.5))).toBeCloseTo(1.5, 5)
    expect(aspectOf(photo(0.75))).toBeCloseTo(0.75, 5)
  })

  it('falls back when the photo is missing or has zero size', () => {
    expect(aspectOf(undefined)).toBeCloseTo(4 / 3, 5)
    expect(aspectOf({ image: {} as CanvasImageSource, width: 0, height: 0 })).toBeCloseTo(4 / 3, 5)
  })

  it('clamps absurd panoramas and extreme portraits into a usable band', () => {
    // 10:1 panorama must not be honoured literally, or the layout explodes.
    expect(aspectOf(photo(10))).toBeLessThanOrEqual(3.2)
    // 1:10 ribbon likewise.
    expect(aspectOf(photo(0.05))).toBeGreaterThanOrEqual(0.32)
  })
})

describe('averageAspect', () => {
  it('averages the set', () => {
    expect(averageAspect([photo(1), photo(2)])).toBeCloseTo(1.5, 5)
  })

  it('returns 1 for an empty set rather than NaN', () => {
    expect(averageAspect([])).toBe(1)
  })
})

describe('fitWindowInside — the no-crop guarantee', () => {
  it('fits a wide photo into a square box without exceeding it', () => {
    const w = fitWindowInside(0, 0, 200, 200, 2)
    expect(w.width).toBeLessThanOrEqual(200.0001)
    expect(w.height).toBeLessThanOrEqual(200.0001)
    // Aspect must be preserved.
    expect(w.width / w.height).toBeCloseTo(2, 5)
  })

  it('fits a tall photo into a square box without exceeding it', () => {
    const w = fitWindowInside(0, 0, 200, 200, 0.5)
    expect(w.width).toBeLessThanOrEqual(200.0001)
    expect(w.height).toBeLessThanOrEqual(200.0001)
    expect(w.width / w.height).toBeCloseTo(0.5, 5)
  })

  it('centres the window inside the box', () => {
    const w = fitWindowInside(100, 50, 200, 100, 1) // square photo, wide box
    expect(w.x + w.width / 2).toBeCloseTo(200, 4)
    expect(w.y + w.height / 2).toBeCloseTo(100, 4)
  })

  it('never returns a negative or zero dimension for degenerate input', () => {
    const w = fitWindowInside(0, 0, 0, 0, 1)
    expect(w.width).toBeGreaterThan(0)
    expect(w.height).toBeGreaterThan(0)
  })
})

describe('pickStyle — automatic paper selection', () => {
  it('never returns a style without a theme', () => {
    for (let n = 1; n <= 6; n += 1) {
      const style = pickStyle(photos(n))
      expect(style).toBeTruthy()
      expect(style.theme).toBeTruthy()
    }
  })

  it('is deterministic for identical input', () => {
    const a = pickStyle(photos(4, 1.5))
    const b = pickStyle(photos(4, 1.5))
    expect(a.id).toBe(b.id)
  })

  it('gives a single photo a single-photo layout, never a grid', () => {
    const style = pickStyle(photos(1))
    expect(['single', 'auto']).toContain(style.layout)
  })

  it('gives multiple photos a layout that is not "single"', () => {
    for (const n of [2, 3, 4]) {
      expect(pickStyle(photos(n)).layout).not.toBe('single')
    }
  })

  it('respects the `among` restriction', () => {
    const only = ['rainbow-auto', 'contact-sheet']
    const style = pickStyle(photos(4), { among: only })
    expect(only).toContain(style.id)
  })
})

describe('buildLayout — geometry integrity', () => {
  const W = 380

  it('produces one slot per photo for every style', () => {
    for (const style of PAPER_STYLES) {
      for (const n of [1, 2, 3, 4]) {
        const layout = buildLayout(style, photos(n), W)
        // A style may clamp the count (e.g. single always shows 1), but it
        // must never produce zero slots or more than it was given.
        expect(layout.slots.length).toBeGreaterThan(0)
        expect(layout.slots.length).toBeLessThanOrEqual(n)
      }
    }
  })

  it('keeps every slot inside the sheet bounds', () => {
    for (const style of PAPER_STYLES) {
      const layout = buildLayout(style, photos(4), W)
      for (const slot of layout.slots) {
        expect(slot.x).toBeGreaterThanOrEqual(-2)
        expect(slot.y).toBeGreaterThanOrEqual(-2)
        expect(slot.x + slot.width).toBeLessThanOrEqual(layout.width + 2)
        expect(slot.y + slot.height).toBeLessThanOrEqual(layout.height + 2)
      }
    }
  })

  it('keeps every photo window inside its own frame', () => {
    for (const style of PAPER_STYLES) {
      const layout = buildLayout(style, photos(4), W)
      for (const slot of layout.slots) {
        const win = slot.window
        expect(win.x).toBeGreaterThanOrEqual(slot.x - 2)
        expect(win.y).toBeGreaterThanOrEqual(slot.y - 2)
        expect(win.x + win.width).toBeLessThanOrEqual(slot.x + slot.width + 2)
        expect(win.y + win.height).toBeLessThanOrEqual(slot.y + slot.height + 2)
      }
    }
  })

  it('never produces a zero-area photo window', () => {
    for (const style of PAPER_STYLES) {
      const layout = buildLayout(style, photos(3), W)
      for (const slot of layout.slots) {
        expect(slot.window.width).toBeGreaterThan(0)
        expect(slot.window.height).toBeGreaterThan(0)
      }
    }
  })

  it('preserves each photo aspect in its window (no cropping)', () => {
    // This is the core promise of the layout engine: a portrait photo gets a
    // portrait window. Allow a small tolerance for rounding.
    const style = STYLE_BY_ID['rainbow-auto']!
    const mixed = [photo(1.5), photo(0.667), photo(1)]
    const layout = buildLayout(style, mixed, W)
    layout.slots.forEach((slot, i) => {
      const src = mixed[slot.index] ?? mixed[i]
      if (!src) return
      const srcAspect = src.width / src.height
      const winAspect = slot.window.width / slot.window.height
      // The window must match the source aspect, not a forced square.
      expect(Math.abs(winAspect - srcAspect)).toBeLessThan(0.02)
    })
  })

  it('scales proportionally with sheet width', () => {
    const style = STYLE_BY_ID['rainbow-auto']!
    const small = buildLayout(style, photos(3), 200)
    const large = buildLayout(style, photos(3), 400)
    expect(large.width / small.width).toBeCloseTo(2, 1)
    expect(large.height / small.height).toBeCloseTo(2, 1)
  })

  it('grows taller with more photos', () => {
    const style = STYLE_BY_ID['rainbow-auto']!
    const one = buildLayout(style, photos(1), W)
    const four = buildLayout(style, photos(4), W)
    expect(four.height).toBeGreaterThan(one.height)
  })
})
