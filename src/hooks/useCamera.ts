import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Lifecycle status of the camera pipeline.
 *
 * - `idle`       — nothing requested yet.
 * - `requesting` — `getUserMedia` is in flight.
 * - `ready`      — a live stream is attached to the video element.
 * - `denied`     — the user (or policy) refused camera permission.
 * - `unavailable`— no camera API (insecure context) or no matching device.
 * - `error`      — any other failure.
 */
export type CameraStatus = 'idle' | 'requesting' | 'ready' | 'denied' | 'unavailable' | 'error'

/** A user-facing error description. `message` is always a friendly Chinese string. */
export interface CameraError {
  code: string
  message: string
}

/** Which physical camera to use. `user` is the selfie (front) camera. */
export type CameraFacing = 'user' | 'environment'

/** A selectable video input reported by `enumerateDevices()`. */
export interface CameraDevice {
  deviceId: string
  label: string
}

/** Everything the hook exposes to its consumer. */
export interface UseCameraResult {
  /** The live media stream, or `null` when no camera is running. */
  stream: MediaStream | null
  /** Current lifecycle status. */
  status: CameraStatus
  /** Last error, or `null` when the camera is healthy. */
  error: CameraError | null
  /** Attach this ref to the `<video>` element that should show the preview. */
  videoRef: React.RefObject<HTMLVideoElement>
  /** Requests camera access and starts the preview. Safe to call repeatedly. */
  start: () => Promise<void>
  /** Stops every track and releases the camera. */
  stop: () => void
  /** Switches between the front ('user') and back ('environment') camera. */
  toggleFacing: () => Promise<void>
  /** The currently selected camera side. */
  facing: CameraFacing
  /** Video input devices discovered on this machine. */
  devices: CameraDevice[]
  /** Selects a specific camera by `deviceId` and restarts the stream. */
  switchDevice: (deviceId: string) => Promise<void>
  /**
   * Grabs the current preview frame as a JPEG data URL.
   *
   * The frame is drawn at the video's natural resolution and mirrored
   * horizontally when the front camera is active (selfie mirror).
   * Resolves to `null` when there is no stream or the video is not ready yet.
   */
  captureFrame: () => Promise<string | null>
}

/** JPEG quality used by {@link UseCameraResult.captureFrame}. */
const CAPTURE_QUALITY = 0.92

/**
 * Maps a `getUserMedia` rejection onto a friendly, Chinese error.
 */
function toCameraError(err: unknown): CameraError {
  const name =
    typeof err === 'object' && err !== null && 'name' in err
      ? String((err as { name: unknown }).name)
      : 'Error'

  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return { code: name, message: '相机权限被拒绝，请在浏览器地址栏允许摄像头权限' }
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return { code: name, message: '没有找到可用的摄像头设备' }
    case 'NotReadableError':
    case 'TrackStartError':
      return { code: name, message: '摄像头被其它程序占用，请关闭后重试' }
    default:
      return { code: name, message: `相机启动失败（${name}），请重试` }
  }
}

/**
 * Hook that owns the whole camera pipeline: permission handling, the live
 * preview stream, device switching and still-frame capture.
 *
 * ```tsx
 * const { videoRef, start, status, captureFrame } = useCamera()
 * // <video ref={videoRef} autoPlay playsInline muted />
 * ```
 *
 * The hook never throws: failures are surfaced through `status` and `error`.
 */
export function useCamera(constraints?: MediaStreamConstraints): UseCameraResult {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<CameraError | null>(null)
  const [facing, setFacing] = useState<CameraFacing>('user')
  const [devices, setDevices] = useState<CameraDevice[]>([])

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const deviceIdRef = useRef<string | null>(null)
  const facingRef = useRef<CameraFacing>('user')
  const mountedRef = useRef(true)

  /** Stops the tracks of the currently held stream (if any). */
  const stopTracks = useCallback(() => {
    const current = streamRef.current
    if (current) {
      for (const track of current.getTracks()) {
        track.stop()
      }
    }
    streamRef.current = null
  }, [])

  /** Releases the camera and resets the hook to `idle`. */
  const stop = useCallback(() => {
    stopTracks()
    if (mountedRef.current) {
      setStream(null)
      setStatus('idle')
    }
  }, [stopTracks])

  /** Refreshes the list of available video input devices. */
  const refreshDevices = useCallback(async () => {
    const media = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined
    if (!media || typeof media.enumerateDevices !== 'function') return

    try {
      const all = await media.enumerateDevices()
      const inputs = all.filter((d) => d.kind === 'videoinput')
      const mapped: CameraDevice[] = inputs.map((d, index) => ({
        deviceId: d.deviceId,
        label: d.label && d.label.length > 0 ? d.label : `摄像头 ${index + 1}`,
      }))
      if (mountedRef.current) setDevices(mapped)
    } catch {
      // Device enumeration can fail in private mode; the list simply stays empty.
    }
  }, [])

  /**
   * Opens the camera with the current facing side and (optionally) device.
   */
  const openStream = useCallback(
    async (side: CameraFacing, deviceId: string | null): Promise<void> => {
      const media = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined
      if (!media || typeof media.getUserMedia !== 'function') {
        if (mountedRef.current) {
          setStatus('unavailable')
          setError({ code: 'NotSupportedError', message: '需要 HTTPS 或 localhost 才能使用摄像头' })
        }
        return
      }

      if (mountedRef.current) {
        setStatus('requesting')
        setError(null)
      }

      const video: MediaTrackConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 960 },
        facingMode: side,
      }
      if (deviceId) video.deviceId = { exact: deviceId }

      // Caller-supplied constraints are merged underneath our defaults, but the
      // resolution/facing/device requirements always win.
      const baseVideo: MediaTrackConstraints =
        typeof constraints?.video === 'object' && constraints.video !== null
          ? constraints.video
          : {}

      const merged: MediaStreamConstraints = {
        ...constraints,
        video: { ...baseVideo, ...video },
        audio: false,
      }

      try {
        const next = await media.getUserMedia(merged)
        // A newer request may have superseded this one while we were awaiting.
        if (!mountedRef.current) {
          for (const track of next.getTracks()) track.stop()
          return
        }
        stopTracks()
        streamRef.current = next
        setStream(next)
        setStatus('ready')
        setError(null)
        void refreshDevices()
      } catch (err) {
        if (!mountedRef.current) return
        const mapped = toCameraError(err)
        setStatus(mapped.code === 'NotAllowedError' ? 'denied' : 'error')
        setError(mapped)
      }
    },
    [constraints, refreshDevices, stopTracks],
  )

  /** Requests camera access and starts the preview. */
  const start = useCallback(async () => {
    await openStream(facingRef.current, deviceIdRef.current)
  }, [openStream])

  /** Flips between the front and back camera. */
  const toggleFacing = useCallback(async () => {
    const next: CameraFacing = facingRef.current === 'user' ? 'environment' : 'user'
    facingRef.current = next
    setFacing(next)
    await openStream(next, deviceIdRef.current)
  }, [openStream])

  /** Selects a specific camera device and restarts the stream with it. */
  const switchDevice = useCallback(
    async (deviceId: string) => {
      deviceIdRef.current = deviceId
      await openStream(facingRef.current, deviceId)
    },
    [openStream],
  )

  /**
   * Captures the current preview frame as a JPEG data URL.
   *
   * Drawing uses the video's natural size so the photo keeps the camera's
   * native resolution. The front camera is mirrored horizontally to match
   * what the user sees in the preview.
   */
  const captureFrame = useCallback(async (): Promise<string | null> => {
    const video = videoRef.current
    const active = streamRef.current
    if (!video || !active) return null

    const readyState = video.readyState
    if (readyState < 2 /* HAVE_CURRENT_DATA */) return null

    const width = video.videoWidth
    const height = video.videoHeight
    if (!width || !height) return null

    try {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) return null

      if (facingRef.current === 'user') {
        // Selfie mirror: flip horizontally around the canvas centre.
        ctx.translate(width, 0)
        ctx.scale(-1, 1)
      }
      ctx.drawImage(video, 0, 0, width, height)

      return canvas.toDataURL('image/jpeg', CAPTURE_QUALITY)
    } catch {
      return null
    }
  }, [])

  // Bind the live stream to the <video> element and keep it playing.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.srcObject = stream
    if (stream) {
      const attempt = video.play()
      if (attempt && typeof attempt.catch === 'function') {
        attempt.catch(() => {
          // Autoplay can be blocked before a user gesture; the next start() retries.
        })
      }
    }
  }, [stream])

  // Keep the mirrored-from-camera preview in sync when the side changes.
  useEffect(() => {
    const video = videoRef.current
    if (video) {
      video.style.transform = facing === 'user' ? 'scaleX(-1)' : 'none'
    }
  }, [facing, stream])

  // Clean up every track when the component unmounts.
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      const current = streamRef.current
      if (current) {
        for (const track of current.getTracks()) track.stop()
      }
      streamRef.current = null
    }
  }, [])

  return {
    stream,
    status,
    error,
    videoRef,
    start,
    stop,
    toggleFacing,
    facing,
    devices,
    switchDevice,
    captureFrame,
  }
}
