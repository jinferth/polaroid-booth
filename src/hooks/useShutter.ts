import { useCallback, useEffect, useRef, useState } from 'react'

/** How long the white flash overlay stays visible, in milliseconds. */
const FLASH_DURATION_MS = 120

/** Length of the synthesised shutter sound, in seconds. */
const SHUTTER_DURATION_S = 0.12

/** Frequency of the low mechanical "click" thud, in Hz. */
const CLICK_FREQUENCY = 120

/** Frequency of the countdown tick beep, in Hz. */
const TICK_FREQUENCY = 880

/** Duration of the countdown tick beep, in seconds. */
const TICK_DURATION_S = 0.06

/** Everything the shutter hook exposes. */
export interface UseShutterResult {
  /** Plays the synthesised shutter sound and triggers the flash overlay. */
  playShutter: () => void
  /** Plays the short countdown beep. */
  playTick: () => void
  /** `true` for ~120ms after {@link UseShutterResult.playShutter} is called. */
  flash: boolean
  /** Alias of {@link UseShutterResult.flash}. */
  isFlashing: boolean
}

/**
 * Hook that synthesises the camera sounds with the Web Audio API (no asset
 * files) and exposes a transient `isFlashing` flag for a white flash overlay.
 *
 * The `AudioContext` is created lazily on the first user gesture and resumed
 * if the browser suspended it, so the sound always plays.
 */
export function useShutter(): UseShutterResult {
  const [isFlashing, setIsFlashing] = useState(false)

  const audioContextRef = useRef<AudioContext | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * Returns a ready-to-use AudioContext, creating it on first use.
   * Returns `null` when Web Audio is unsupported (e.g. older browsers).
   */
  const getContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null

    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null

    let ctx = audioContextRef.current
    if (!ctx) {
      try {
        ctx = new Ctor()
      } catch {
        return null
      }
      audioContextRef.current = ctx
    }

    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {
        // The context stays suspended; playback calls below become no-ops.
      })
    }
    return ctx
  }, [])

  /**
   * Plays the shutter sound: a short filtered noise burst (the mirror slap)
   * layered with a low click thud (the mechanism).
   */
  const playShutter = useCallback(() => {
    // Flash overlay: turn on now, turn off after ~120ms.
    setIsFlashing(true)
    if (flashTimerRef.current !== null) {
      clearTimeout(flashTimerRef.current)
    }
    flashTimerRef.current = setTimeout(() => {
      flashTimerRef.current = null
      setIsFlashing(false)
    }, FLASH_DURATION_MS)

    const ctx = getContext()
    if (!ctx) return

    const now = ctx.currentTime
    const end = now + SHUTTER_DURATION_S

    try {
      // --- Noise burst through a bandpass filter (the mechanical "slap") ---
      const frameCount = Math.max(1, Math.floor(ctx.sampleRate * SHUTTER_DURATION_S))
      const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate)
      const channel = buffer.getChannelData(0)
      for (let i = 0; i < frameCount; i += 1) {
        // Fade the noise in and out so the burst does not click.
        const progress = i / frameCount
        const envelope = Math.sin(Math.PI * progress)
        channel[i] = (Math.random() * 2 - 1) * envelope
      }

      const noise = ctx.createBufferSource()
      noise.buffer = buffer

      const bandpass = ctx.createBiquadFilter()
      bandpass.type = 'bandpass'
      bandpass.frequency.value = 1800
      bandpass.Q.value = 0.9

      const highpass = ctx.createBiquadFilter()
      highpass.type = 'highpass'
      highpass.frequency.value = 700

      const noiseGain = ctx.createGain()
      noiseGain.gain.setValueAtTime(0.0001, now)
      noiseGain.gain.exponentialRampToValueAtTime(0.9, now + 0.005)
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + SHUTTER_DURATION_S)

      noise.connect(bandpass)
      bandpass.connect(highpass)
      highpass.connect(noiseGain)
      noiseGain.connect(ctx.destination)

      noise.start(now)
      noise.stop(end)

      // --- Low click thud (the mechanism closing) ---
      const click = ctx.createOscillator()
      click.type = 'triangle'
      click.frequency.setValueAtTime(CLICK_FREQUENCY, now)
      click.frequency.exponentialRampToValueAtTime(CLICK_FREQUENCY * 0.55, end)

      const clickGain = ctx.createGain()
      clickGain.gain.setValueAtTime(0.0001, now)
      clickGain.gain.exponentialRampToValueAtTime(0.5, now + 0.004)
      clickGain.gain.exponentialRampToValueAtTime(0.0001, end)

      click.connect(clickGain)
      clickGain.connect(ctx.destination)

      click.start(now)
      click.stop(end)
    } catch {
      // Audio graph failure must never break the capture flow.
    }
  }, [getContext])

  /** Plays the short countdown beep. */
  const playTick = useCallback(() => {
    const ctx = getContext()
    if (!ctx) return

    const now = ctx.currentTime
    const end = now + TICK_DURATION_S

    try {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = TICK_FREQUENCY

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.35, now + 0.005)
      gain.gain.exponentialRampToValueAtTime(0.0001, end)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(end)
    } catch {
      // Ignore audio failures.
    }
  }, [getContext])

  // Clean up the flash timer and close the audio context on unmount.
  useEffect(() => {
    return () => {
      if (flashTimerRef.current !== null) {
        clearTimeout(flashTimerRef.current)
        flashTimerRef.current = null
      }
      const ctx = audioContextRef.current
      audioContextRef.current = null
      if (ctx) {
        void ctx.close().catch(() => {
          // Closing an already-closed context rejects; ignore it.
        })
      }
    }
  }, [])

  return { playShutter, playTick, flash: isFlashing, isFlashing }
}
