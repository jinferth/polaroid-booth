import { describe, expect, it } from 'vitest'

import {
  CAPTION_FONT_RATIO,
  createSticker,
  createStickerInstance,
  HOT_PACKS,
  STICKER_BY_ID,
  STICKER_CATEGORIES,
  STICKER_FONT_RATIO,
  STICKERS,
  STICKERS_BY_CATEGORY,
  stickerFontSize,
  STICKER_MAX_SCALE,
  STICKER_MIN_SCALE,
  type StickerItem,
} from '../src/lib/stickers'

describe('sticker catalogue', () => {
  it('has unique ids', () => {
    const ids = STICKERS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every sticker belongs to a declared category', () => {
    const cats = new Set(STICKER_CATEGORIES.map((c) => c.id))
    for (const s of STICKERS) {
      expect(cats.has(s.category)).toBe(true)
    }
  })

  it('every category has at least one sticker', () => {
    for (const c of STICKER_CATEGORIES) {
      expect((STICKERS_BY_CATEGORY[c.id] ?? []).length).toBeGreaterThan(0)
    }
  })

  it('includes the 2026 meme packs', () => {
    const ids = STICKER_CATEGORIES.map((c) => c.id)
    // These packs are the reason the sticker set was rewritten.
    expect(ids).toContain('fushu') // 背手负鼠
    expect(ids).toContain('kukum') // 哭哭马
    expect(ids).toContain('btsx') // 不烧心
  })

  it('marks at least one pack as trending', () => {
    expect(HOT_PACKS.size).toBeGreaterThan(0)
  })

  it('caption stickers carry their own colours', () => {
    const captions = STICKERS.filter((s) => s.kind === 'caption')
    expect(captions.length).toBeGreaterThan(0)
    for (const c of captions) {
      expect(typeof c.fill).toBe('string')
      expect(typeof c.stroke).toBe('string')
      expect(typeof c.color).toBe('string')
    }
  })

  it('the lookup table agrees with the array', () => {
    for (const s of STICKERS) {
      expect(STICKER_BY_ID[s.id]?.glyph).toBe(s.glyph)
    }
  })
})

describe('createSticker', () => {
  it('seeds scale from the catalogue default', () => {
    const def = STICKERS[0]!
    const item = createSticker(def, 0.5, 0.5)
    expect(item.scale).toBe(def.size)
  })

  it('clamps positions into the 0..1 range', () => {
    const def = STICKERS[0]!
    expect(createSticker(def, -3, 9).x).toBe(0)
    expect(createSticker(def, -3, 9).y).toBe(1)
  })

  it('carries the caption styling across for caption stickers', () => {
    const def = STICKERS.find((s) => s.kind === 'caption')!
    const item = createSticker(def, 0.5, 0.5)
    expect(item.kind).toBe('caption')
    expect(item.fill).toBe(def.fill)
  })

  it('createStickerInstance gives every placement a unique id', () => {
    const def = STICKERS[0]!
    const a = createStickerInstance(def, 0.3, 0.3)
    const b = createStickerInstance(def, 0.3, 0.3)
    expect(a.id).not.toBe(b.id)
  })
})

describe('stickerFontSize — the DOM/Canvas sizing contract', () => {
  it('glyph stickers scale with the sheet width', () => {
    const item: StickerItem = { id: 'a', glyph: '★', x: 0.5, y: 0.5, scale: 1, rotation: 0 }
    const small = stickerFontSize(item, 200)
    const large = stickerFontSize(item, 400)
    expect(large).toBeCloseTo(small * 2, 0)
  })

  it('uses the shared glyph ratio', () => {
    const item: StickerItem = { id: 'a', glyph: '★', x: 0.5, y: 0.5, scale: 1, rotation: 0 }
    expect(stickerFontSize(item, 1000)).toBeCloseTo(1000 * STICKER_FONT_RATIO, 0)
  })

  it('caption stickers use the smaller caption ratio so phrases fit', () => {
    const item: StickerItem = {
      id: 'a',
      glyph: '关于明天的事',
      x: 0.5,
      y: 0.5,
      scale: 1,
      rotation: 0,
      kind: 'caption',
    }
    expect(stickerFontSize(item, 1000)).toBeCloseTo(1000 * CAPTION_FONT_RATIO, 0)
    // A caption must be smaller than a glyph at the same scale.
    expect(CAPTION_FONT_RATIO).toBeLessThan(STICKER_FONT_RATIO)
  })

  it('never returns a font size below the legibility floor', () => {
    const item: StickerItem = { id: 'a', glyph: '★', x: 0.5, y: 0.5, scale: 0.01, rotation: 0 }
    expect(stickerFontSize(item, 10)).toBeGreaterThanOrEqual(8)
  })

  it('treats a non-finite scale as 1', () => {
    const item: StickerItem = { id: 'a', glyph: '★', x: 0.5, y: 0.5, scale: NaN, rotation: 0 }
    expect(stickerFontSize(item, 100)).toBeGreaterThan(0)
  })
})

describe('scale bounds', () => {
  it('declares a usable min/max range', () => {
    expect(STICKER_MIN_SCALE).toBeLessThan(1)
    expect(STICKER_MAX_SCALE).toBeGreaterThan(1)
  })
})
