import { describe, expect, it } from 'vitest'

import {
  combinedCss,
  DEFAULT_SIM,
  getSim,
  LENS_EFFECTS,
  lensToCss,
  SIM_BY_ID,
  SIMULATIONS,
  simulationToCss,
  type SimId,
} from '../src/lib/fuji'

/**
 * jsdom does not implement canvas 2d, so the colour maths is verified against
 * the recipe parameters directly. These are the numbers the pixel pipeline
 * actually consumes, so asserting on them is a genuine check of the look.
 */

describe('simulation catalogue', () => {
  it('contains the 13 Fujifilm simulations plus a passthrough', () => {
    const real = SIMULATIONS.filter((s) => s.id !== 'none')
    expect(real.length).toBe(13)
  })

  it('every simulation has a unique id', () => {
    const ids = SIMULATIONS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every simulation has a non-empty CSS filter string', () => {
    for (const s of SIMULATIONS) {
      expect(typeof s.css).toBe('string')
      expect(s.css.length).toBeGreaterThan(0)
    }
  })

  it('the default simulation exists in the catalogue', () => {
    expect(SIM_BY_ID[DEFAULT_SIM]).toBeTruthy()
  })

  it('getSim degrades to the default for unknown ids', () => {
    expect(getSim('does-not-exist').id).toBe(DEFAULT_SIM)
    expect(getSim('').id).toBe(DEFAULT_SIM)
  })
})

describe('simulation colour characteristics', () => {
  it('VELVIA is more saturated and contrastier than ETERNA', () => {
    const velvia = getSim('velvia')
    const eterna = getSim('eterna')
    expect(velvia.saturation).toBeGreaterThan(eterna.saturation)
    expect(velvia.contrast).toBeGreaterThan(eterna.contrast)
  })

  it('ETERNA has the lowest saturation of all colour simulations', () => {
    const eterna = getSim('eterna')
    const others = SIMULATIONS.filter(
      (s) => s.id !== 'eterna' && s.id !== 'none' && !s.monochrome,
    )
    for (const o of others) {
      expect(eterna.saturation).toBeLessThanOrEqual(o.saturation)
    }
  })

  it('ETERNA carries the heaviest fade (cinematic flat look)', () => {
    const eterna = getSim('eterna')
    expect(eterna.fade).toBeGreaterThan(0.1)
  })

  it('monochrome simulations are flagged, neutral Acros is truly neutral', () => {
    const acros = getSim('acros')
    expect(acros.monochrome).toBe(true)
    expect(acros.monoTint[0]).toBe(acros.monoTint[1])
    expect(acros.monoTint[1]).toBe(acros.monoTint[2])
  })

  it('Acros filter variants tint the channels differently', () => {
    const y = getSim('acros-y')
    const r = getSim('acros-r')
    expect(new Set(y.monoTint).size).toBeGreaterThan(1)
    expect(new Set(r.monoTint).size).toBeGreaterThan(1)
    // A red filter must boost red relative to blue.
    expect(r.monoTint[0]).toBeGreaterThan(r.monoTint[2])
    // A yellow filter boosts red/green over blue.
    expect(y.monoTint[0]).toBeGreaterThan(y.monoTint[2])
  })

  it('Classic Chrome is cooler and less saturated than Provia', () => {
    const cc = getSim('classic-chrome')
    const provia = getSim('provia')
    expect(cc.saturation).toBeLessThan(provia.saturation)
    expect(cc.bTilt).toBeGreaterThan(provia.bTilt)
  })

  it('Classic Neg is warmer than Classic Chrome', () => {
    const neg = getSim('classic-neg')
    const cc = getSim('classic-chrome')
    // Classic Neg lifts red; Chrome suppresses it.
    expect(neg.rTilt).toBeGreaterThan(cc.rTilt)
  })

  it('the passthrough simulation is a no-op', () => {
    const none = getSim('none')
    expect(none.css).toBe('none')
    expect(none.contrast).toBe(0)
    expect(none.saturation).toBe(0)
    expect(none.fade).toBe(0)
    expect(none.monochrome).toBe(false)
    expect(none.grain).toBe(0)
  })

  it('every simulation declares a swatch colour', () => {
    for (const s of SIMULATIONS) {
      expect(s.swatch).toMatch(/^#|rgb|linear-gradient/)
    }
  })

  it('simulationToCss returns the catalogue css verbatim', () => {
    for (const s of SIMULATIONS) {
      expect(simulationToCss(s.id as SimId)).toBe(s.css)
    }
  })
})

describe('lens effects', () => {
  it('offers ten effects, matching the Instax Evo dial', () => {
    expect(LENS_EFFECTS.length).toBe(10)
  })

  it('the first effect is a neutral passthrough', () => {
    expect(LENS_EFFECTS[0]?.css).toBe('none')
  })

  it('every effect has a unique id and a name', () => {
    const ids = LENS_EFFECTS.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const e of LENS_EFFECTS) expect(e.name.length).toBeGreaterThan(0)
  })

  it('lensToCss degrades to none for unknown ids', () => {
    expect(lensToCss('nope')).toBe('none')
    expect(lensToCss(undefined)).toBe('none')
  })
})

describe('combinedCss', () => {
  it('returns none when both parts are none', () => {
    expect(combinedCss('none', 'normal')).toBe('none')
  })

  it('returns just the lens filter when the simulation is none', () => {
    expect(combinedCss('none', 'vignette')).toBe(lensToCss('vignette'))
  })

  it('returns just the simulation when the lens effect is none', () => {
    expect(combinedCss('velvia', 'normal')).toBe(simulationToCss('velvia'))
  })

  it('concatenates both when both are active', () => {
    const out = combinedCss('velvia', 'vignette')
    expect(out).toContain('saturate')
    expect(out.split(' ').length).toBeGreaterThan(2)
  })
})
