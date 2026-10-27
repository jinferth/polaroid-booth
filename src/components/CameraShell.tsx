import { useCallback, useEffect, useRef, useState } from 'react'

import '../camera-shell.css'
import { useCamera } from '../hooks/useCamera'
import { useCountdown } from '../hooks/useCountdown'
import { useShutter } from '../hooks/useShutter'
import { bodyToCssVars, type CameraBody } from '../lib/bodies'
import { combinedCss, LENS_EFFECTS, SIMULATIONS, type SimId } from '../lib/fuji'
import { PhotoIcon, UploadIcon } from './icons'
import '../camera-shapes.css'

/** How many photos a strip holds. */
const SHOT_COUNT = 4

/** Seconds on the countdown before each shot. */
const COUNTDOWN_SECONDS = 3

/** Largest upload we will accept, in bytes (~24 MB of decoded pixels). */
const MAX_UPLOAD_BYTES = 24 * 1024 * 1024

interface CameraShellProps {
  /** Fired with every photo of the session, once all four are ready. */
  onComplete: (shots: string[]) => void
  /** The film simulation currently selected. */
  sim: SimId
  /** Change the film simulation. */
  onSimChange: (sim: SimId) => void
  /** The camera body currently fitted. */
  body: CameraBody
}

/**
 * A skeuomorphic instant camera rendered entirely in CSS.
 *
 * The interaction follows real hardware: tap the **lens** to wake the camera,
 * press the **shutter** on the top plate to shoot, turn the **dial** to change
 * film simulation, and watch each print slide out of the top and develop.
 *
 * The body is swappable — its colours come from `bodies.ts` as CSS custom
 * properties, and its `finish` drives a surface treatment so a gloss body and
 * a matte body genuinely look different.
 */
export function CameraShell({ onComplete, sim, onSimChange, body }: CameraShellProps) {
  const camera = useCamera()
  const shutter = useShutter()
  const countdown = useCountdown(COUNTDOWN_SECONDS, {
    onTick: () => shutter.playTick(),
  })

  const [shots, setShots] = useState<string[]>([])
  const [isShooting, setIsShooting] = useState(false)
  const [isSnapping, setIsSnapping] = useState(false)
  const [knobTurn, setKnobTurn] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  /** Evo-style lens effect index. */
  const [lensEffect, setLensEffect] = useState(0)
  const [lensKnobTurn, setLensKnobTurn] = useState(0)

  const sessionRef = useRef<string[]>([])
  const abortRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const isLive = camera.status === 'ready'
  const isFull = shots.length >= SHOT_COUNT
  const lastShot = shots.length > 0 ? shots[shots.length - 1] : null
  const activeSim = SIMULATIONS.find((s) => s.id === sim) ?? SIMULATIONS[0]!

  /** The CSS filter combining the film simulation and the lens effect. */
  const viewFilter = combinedCss(sim, LENS_EFFECTS[lensEffect]?.id)

  /** Turn the dial to the next film simulation. */
  const cycleSim = () => {
    const idx = SIMULATIONS.findIndex((s) => s.id === sim)
    const next = SIMULATIONS[(idx + 1) % SIMULATIONS.length]
    if (next) {
      onSimChange(next.id)
      setKnobTurn((t) => t + 360)
    }
  }

  /** Turn the lens dial to the next optical effect. */
  const cycleLensEffect = () => {
    setLensEffect((i) => (i + 1) % LENS_EFFECTS.length)
    setLensKnobTurn((t) => t + 360)
  }

  useEffect(() => {
    return () => {
      abortRef.current = true
      camera.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------------------------------------------------------------------- */
  /* Upload path                                                            */
  /* ---------------------------------------------------------------------- */

  /**
   * Read a File into a JPEG/PNG data URL, downscaling very large images so
   * the strip renderer and localStorage stay fast.
   */
  const ingestFile = useCallback(async (file: File): Promise<string | null> => {
    if (!file.type.startsWith('image/')) {
      setUploadError('请选择图片文件')
      return null
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError('图片太大了，请选择 24MB 以内的照片')
      return null
    }

    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    })
    if (!dataUrl) {
      setUploadError('读取图片失败，请重试')
      return null
    }

    // Downscale anything above 1600px on the long edge.
    const img = await new Promise<HTMLImageElement | null>((resolve) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => resolve(null)
      el.src = dataUrl
    })
    if (!img) {
      setUploadError('这张图片无法解析')
      return null
    }

    const MAX_EDGE = 1600
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
    if (scale >= 1) return dataUrl

    const c = document.createElement('canvas')
    c.width = Math.round(img.naturalWidth * scale)
    c.height = Math.round(img.naturalHeight * scale)
    c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.92)
  }, [])

  /** Add one or more uploaded images to the current session. */
  const addUploads = useCallback(
    async (files: FileList | File[]) => {
      setUploadError(null)
      const list = Array.from(files).slice(0, SHOT_COUNT - sessionRef.current.length)
      if (list.length === 0) return

      const added: string[] = []
      for (const file of list) {
        const url = await ingestFile(file)
        if (url) added.push(url)
      }
      if (added.length === 0) return

      shutter.playShutter()
      setIsSnapping(true)
      window.setTimeout(() => setIsSnapping(false), 280)

      const next = [...sessionRef.current, ...added].slice(0, SHOT_COUNT)
      sessionRef.current = next
      setShots(next)
    },
    [ingestFile, shutter],
  )

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) void addUploads(files)
    e.target.value = '' // allow re-picking the same file
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) void addUploads(e.dataTransfer.files)
  }

  /* ---------------------------------------------------------------------- */
  /* Capture path                                                           */
  /* ---------------------------------------------------------------------- */

  /** One press → one frame. */
  const fire = async (): Promise<boolean> => {
    if (!isLive) return false
    setIsSnapping(true)
    window.setTimeout(() => setIsSnapping(false), 280)
    const frame = await camera.captureFrame()
    shutter.playShutter()
    if (!frame) return false
    const next = [...sessionRef.current, frame].slice(0, SHOT_COUNT)
    sessionRef.current = next
    setShots(next)
    return true
  }

  /**
   * Automatic session: countdown → shoot, filling the remaining slots.
   *
   * Does **not** jump to the editor when done — the user may want to add a
   * couple more, upload one, or go develop right away. "去显影" is always
   * available once at least one photo exists.
   */
  const handleAuto = async () => {
    if (isShooting) return
    abortRef.current = false
    setIsShooting(true)
    try {
      for (let i = sessionRef.current.length; i < SHOT_COUNT; i += 1) {
        if (abortRef.current) return
        await countdown.start()
        if (abortRef.current) return
        const ok = await fire()
        if (!ok) return
        if (i < SHOT_COUNT - 1) await new Promise((r) => setTimeout(r, 420))
      }
    } finally {
      setIsShooting(false)
    }
  }

  const handleReset = () => {
    abortRef.current = true
    sessionRef.current = []
    setShots([])
    setUploadError(null)
    countdown.reset()
  }

  const ledClass =
    isShooting || countdown.isRunning
      ? 'is-counting'
      : isLive
        ? 'is-live'
        : camera.status === 'denied' || camera.status === 'error'
          ? 'is-error'
          : ''

  return (
    <div
      className="cam-stage"
      onDragOver={(e) => {
        e.preventDefault()
        if (!isFull) setIsDragging(true)
      }}
      onDragLeave={(e) => {
        // Only clear when the pointer truly leaves the stage.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsDragging(false)
      }}
      onDrop={onDrop}
    >
      <div
        className={`cam-shell shape-${body.shape} finish-${body.colors.finish} ${isSnapping ? 'is-snapping' : ''} ${shutter.flash ? 'is-flashing' : ''}`}
        style={bodyToCssVars(body) as React.CSSProperties}
      >
        {/* --- The print sliding out of the top slot --------------------- */}
        <div className={`cam-print-slot ${lastShot ? 'has-print' : ''}`} aria-hidden={lastShot === null}>
          {lastShot && (
            <div key={shots.length} className="cam-print is-out">
              <div className="cam-print-shot">
                <img
                  src={lastShot}
                  alt={`第 ${shots.length} 张`}
                  style={{ filter: viewFilter }}
                />
              </div>
              <p className="cam-print-caption">
                第 {shots.length} 张 · {activeSim.name}
              </p>
              <span className="cam-print-date">
                {shots.length} / {SHOT_COUNT}
              </span>
            </div>
          )}
        </div>

        {/* --- Strap lugs ---------------------------------------------- */}
        <span className="cam-lug cam-lug-left" />
        <span className="cam-lug cam-lug-right" />

        {/* --- Shutter on the silver top plate -------------------------- */}
        <button
          type="button"
          className={`cam-shutter ${isShooting ? 'is-pressed' : ''}`}
          onClick={() => void (!isFull && !isShooting && isLive ? handleAuto() : undefined)}
          disabled={!isLive || isShooting || isFull}
          aria-label="按下快门"
          title={isLive ? '按下快门，连拍四张' : '请先点击镜头启动相机'}
        />
        {!isLive && shots.length === 0 && (
          <span className="cam-shutter-hint" aria-hidden="true">
            先点镜头
          </span>
        )}

        {/* --- Body ------------------------------------------------------ */}
        <div className="cam-body">
          <div className="cam-flashwin" />
          <div className="cam-finder" />
          <span className={`cam-led ${ledClass}`} />

          {/* Lens = live viewfinder */}
          <div className="cam-lens">
            <div className="cam-lens-ring-outer" />
            <div className="cam-lens-ring-knurl" />
            <button
              type="button"
              className={`cam-lens-glass ${isLive ? 'is-live' : ''} ${shutter.flash ? 'is-flashing' : ''}`}
              onClick={() => {
                if (isLive) camera.stop()
                else void camera.start()
              }}
              aria-label={isLive ? '关闭相机' : '打开相机'}
            >
              <video ref={camera.videoRef} autoPlay playsInline muted style={{ filter: viewFilter }} />
              <div className="cam-lens-flash" />
              <div className="cam-lens-hint">
                {camera.status === 'requesting'
                  ? '唤醒中…'
                  : camera.status === 'denied' ||
                      camera.status === 'error' ||
                      camera.status === 'unavailable'
                    ? (camera.error?.message ?? '相机不可用')
                    : '点我开镜'}
              </div>
              {countdown.count > 0 && (
                <div className="cam-count">
                  <span key={countdown.count}>{countdown.count}</span>
                </div>
              )}
            </button>
          </div>

          {/* Brand plate */}
          <div className="cam-brand">
            <strong>FUJIFILM</strong>
            <small>INSTAX · SX-70</small>
          </div>

          {/* Film simulation dial */}
          <button
            type="button"
            className="cam-simdial"
            onClick={cycleSim}
            aria-label={`切换胶片模拟，当前 ${activeSim.name}`}
            title="转动拨盘切换胶片模拟"
          >
            <span className="cam-knob" style={{ transform: `rotate(${knobTurn}deg)` }} />
            <small>{activeSim.name}</small>
          </button>

          {/* Evo's second dial: lens effect. Only shown on `.shape-evo`. */}
          <button
            type="button"
            className="cam-lensdial"
            onClick={cycleLensEffect}
            aria-label={`切换镜头效果，当前 ${LENS_EFFECTS[lensEffect]?.name ?? '标准'}`}
            title="转动镜头拨盘切换镜头效果"
          >
            <span
              className="cam-knob"
              style={{ transform: `rotate(${lensKnobTurn}deg)` }}
            />
            <small>{LENS_EFFECTS[lensEffect]?.name ?? '标准'}</small>
          </button>

          {/* SX-70's twin exposure/focus wheels. Only shown on `.shape-sx70`. */}
          <div className="cam-wheelpair" aria-hidden="true">
            <span className="cam-wheel" />
            <span className="cam-wheel" />
          </div>
        </div>

        {/* --- Decorative accents -------------------------------------- */}
        <svg className="cam-deco cam-deco-left" viewBox="0 0 40 40" aria-hidden="true">
          <path
            d="M20 35C20 35 4 25.5 4 13.5 4 7.7 8.4 4 13 4c3 0 5.6 1.5 7 3.8C21.4 5.5 24 4 27 4c4.6 0 9 3.7 9 9.5C36 25.5 20 35 20 35z"
            fill="#d0342c"
            stroke="#0e0e10"
            strokeWidth="1.6"
          />
        </svg>
        <svg className="cam-deco cam-deco-right" viewBox="0 0 40 40" aria-hidden="true">
          <path
            d="M20 3l4.6 10.6L36 15l-8.7 7.8L30 34.4 20 28.3 10 34.4l2.7-11.6L4 15l11.4-1.4z"
            fill="#e8dcc0"
            stroke="#0e0e10"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>

        {/* --- Drag-and-drop veil -------------------------------------- */}
        {isDragging && (
          <div className="absolute inset-0 z-50 grid place-items-center rounded-[3em] bg-fuji-black/80 backdrop-blur-sm">
            <div className="text-center text-white">
              <PhotoIcon size={30} className="mx-auto mb-2" />
              <p className="font-display text-lg">松手放进相机</p>
              <p className="mt-1 text-xs opacity-70">图片会作为这一条相纸的照片</p>
            </div>
          </div>
        )}
      </div>

      {/* --- Below the machine: session state & escape hatch ------------ */}
      <div className="mt-6 flex w-full max-w-md flex-col items-center gap-3">
        <div className="flex items-center gap-3">
          {Array.from({ length: SHOT_COUNT }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 w-8 rounded-full transition-all duration-300 ${
                i < shots.length ? 'bg-fuji-red shadow-[0_0_10px_rgba(208,52,44,0.8)]' : 'bg-ink/15'
              }`}
            />
          ))}
        </div>

        <p className="min-h-[1.25rem] text-center text-sm text-ink-soft">
          {uploadError ??
            (isShooting
              ? `拍摄中… 第 ${shots.length + 1} 张`
              : isFull
                ? '拍满了，也可以直接去显影'
                : shots.length > 0
                  ? `已经有 ${shots.length} 张，随时可以去显影`
                  : isLive
                    ? '点镜头开关相机，按机顶快门连拍'
                    : '点镜头开镜，或者直接上传照片')}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            className="btn btn-accent btn-sm"
            onClick={() => void handleAuto()}
            disabled={!isLive || isShooting || isFull}
          >
            自动连拍
          </button>

          {/* Upload */}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isFull || isShooting}
          >
            <UploadIcon size={15} />
            上传照片
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onPickFiles}
          />

          {shots.length > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleReset} disabled={isShooting}>
              清空
            </button>
          )}
          {/* Available as soon as there is at least one photo. */}
          {shots.length > 0 && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onComplete(sessionRef.current)}
              disabled={isShooting}
            >
              去显影 →
            </button>
          )}
        </div>

        <p className="text-center text-[11px] leading-relaxed text-ink-faint">
          可以把照片直接拖到这台相机上
        </p>
      </div>
    </div>
  )
}
