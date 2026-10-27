import { useCallback, useEffect, useRef, useState } from 'react'

/** Callbacks fired while the countdown runs. */
export interface CountdownOptions {
  /** Called on every tick with the value that is about to be shown. */
  onTick?: (count: number) => void
  /** Called once when the countdown reaches its end. */
  onComplete?: () => void
}

/** Everything the countdown hook exposes. */
export interface UseCountdownResult {
  /** The number currently on screen. `0` when the countdown is not running. */
  count: number
  /** Whether a countdown is currently ticking. */
  isRunning: boolean
  /** Starts the countdown and resolves when it finishes. */
  start: () => Promise<void>
  /** Stops the countdown early (the promise resolves). */
  stop: () => void
  /** Stops the countdown and resets the counter back to `0`. */
  reset: () => void
  /** The in-flight promise, or `null` when the countdown is idle. */
  promise: Promise<void> | null
}

/**
 * Hook that runs a 3-2-1 style countdown.
 *
 * The count goes from `seconds` down to `1` and never displays `0`. It can be
 * driven with callbacks or awaited directly:
 *
 * ```tsx
 * const countdown = useCountdown(3, { onTick: playTick })
 * await countdown.start()   // resolves when the countdown finishes
 * ```
 *
 * The interval is stored in a ref and always cleared on unmount.
 */
export function useCountdown(seconds: number = 3, options: CountdownOptions = {}): UseCountdownResult {
  const [count, setCount] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [promise, setPromise] = useState<Promise<void> | null>(null)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const resolveRef = useRef<(() => void) | null>(null)
  const mountedRef = useRef(true)
  const valueRef = useRef(0)
  const optionsRef = useRef(options)
  optionsRef.current = options

  /** Clears the interval and resolves any pending promise. */
  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    const resolve = resolveRef.current
    resolveRef.current = null
    if (resolve) resolve()
  }, [])

  /** Stops the countdown early; the returned promise resolves. */
  const stop = useCallback(() => {
    clearTimer()
    valueRef.current = 0
    if (mountedRef.current) {
      setIsRunning(false)
      setCount(0)
      setPromise(null)
    }
  }, [clearTimer])

  /** Stops the countdown and resets the counter. */
  const reset = useCallback(() => {
    stop()
  }, [stop])

  /** Starts counting down from `seconds` down to 1. */
  const start = useCallback(async (): Promise<void> => {
    // Restarting clears any previous run.
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    const previousResolve = resolveRef.current
    resolveRef.current = null
    if (previousResolve) previousResolve()

    const total = Math.max(1, Math.floor(seconds))

    const next = new Promise<void>((resolve) => {
      resolveRef.current = resolve
    })
    setPromise(next)

    valueRef.current = total
    setIsRunning(true)
    setCount(total)
    optionsRef.current.onTick?.(total)

    intervalRef.current = setInterval(() => {
      const nextValue = valueRef.current - 1

      if (nextValue <= 0) {
        // Finished: the display never shows 0.
        valueRef.current = 0
        clearTimer()
        if (mountedRef.current) {
          setIsRunning(false)
          setCount(0)
          setPromise(null)
        }
        optionsRef.current.onComplete?.()
        return
      }

      valueRef.current = nextValue
      if (mountedRef.current) setCount(nextValue)
      optionsRef.current.onTick?.(nextValue)
    }, 1000)

    return next
  }, [clearTimer, seconds])

  // Cleanup on unmount so no timer survives the component.
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      const resolve = resolveRef.current
      resolveRef.current = null
      if (resolve) resolve()
    }
  }, [])

  return { count, isRunning, start, stop, reset, promise }
}
