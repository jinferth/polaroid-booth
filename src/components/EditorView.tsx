import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { SIMULATIONS, type SimId } from '../lib/fuji'
import {
  downloadCanvas,
  PAPER_STYLES,
  pickStyle,
  renderPaper,
  STYLE_BY_ID,
  type PaperStyle,
  type PhotoFrame,
} from '../lib/polaroid'
import {
  HOT_PACKS,
  STICKERS,
  STICKER_CATEGORIES,
  createStickerInstance,
  type StickerCategory,
  type StickerItem,
} from '../lib/stickers'
import { StickerLayer } from './StickerLayer'
import {
  ArrowLeftIcon,
  DownloadIcon,
  FilterIcon,
  PhotoIcon,
  ShareIcon,
  SparkleIcon,
  StickerIcon,
  TextIcon,
  TrashIcon,
} from './icons'

/** Logical width of the rendered sheet, in CSS pixels. */
const SHEET_WIDTH = 380

/**
 * Export resolutions.
 *
 * The sheet is re-rendered at `SHEET_WIDTH × scale` on an off-screen canvas,
 * so these are true resolution increases — every vector detail (frames,
 * captions, stickers) is redrawn at the larger size rather than upscaled.
 */
const EXPORT_QUALITIES = [
  { id: '1x', label: '标准', scale: 1, note: '380px · 快速预览' },
  { id: '2x', label: '高清', scale: 2, note: '760px · 发朋友圈' },
  { id: '3x', label: '超清', scale: 3, note: '1140px · 打印' },
] as const

type ExportQualityId = (typeof EXPORT_QUALITIES)[number]['id']

/**
 * A stand-in frame used only for *style selection* before the real images
 * have decoded — it carries a 4:3 shape and is never drawn.
 */
const PLACEHOLDER_FRAME: PhotoFrame = {
  image: {} as CanvasImageSource,
  width: 1280,
  height: 960,
}

interface EditorViewProps {
  /** The photos that were just captured. */
  photos: string[]
  /** Go back to the studio to retake. */
  onBack: () => void
  /** Hand a finished sheet to the gallery. */
  onFinish: (stripDataUrl: string, caption: string) => void
  /** The film simulation chosen in the studio. */
  sim: SimId
  /** Change the film simulation from inside the editor. */
  onSimChange: (sim: SimId) => void
}

/**
 * The composition screen: arrange the photos onto a paper design, apply a
 * Fujifilm film simulation, write a caption, drop stickers, then export.
 *
 * The paper design is picked automatically from the photos (count + shape),
 * and can be overridden from the style rail.
 */
export function EditorView({ photos, onBack, onFinish, sim, onSimChange }: EditorViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [caption, setCaption] = useState('')
  const [stickers, setStickers] = useState<StickerItem[]>([])
  const [activeCategory, setActiveCategory] = useState<StickerCategory>('fushu')
  const [isDeveloping, setIsDeveloping] = useState(true)
  /** User override; `null` means "let the auto-picker decide". */
  const [pickedStyleId, setPickedStyleId] = useState<string | null>(null)

  /** Seeded once per session so the rotation jitter stays stable. */
  const seedRef = useRef(Math.floor(Math.random() * 100000))

  const dateStamp = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  }, [])

  /** Decode the captured data URLs into drawable images. */
  const [frames, setFrames] = useState<PhotoFrame[]>([])
  const [imagesReady, setImagesReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    setImagesReady(false)

    const loaded = photos.map(
      (src) =>
        new Promise<PhotoFrame>((resolve) => {
          const img = new Image()
          img.onload = () =>
            resolve({
              image: img,
              width: img.naturalWidth || 1280,
              height: img.naturalHeight || 960,
            })
          img.onerror = () =>
            resolve({ image: img, width: 1280, height: 960 })
          img.src = src
        }),
    )

    void Promise.all(loaded).then((f) => {
      if (!cancelled) {
        setFrames(f)
        setImagesReady(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [photos])

  /** The design actually in use: the user's pick, else the auto-selection. */
  const style: PaperStyle = useMemo(() => {
    if (pickedStyleId) {
      const found = STYLE_BY_ID[pickedStyleId]
      if (found) return found
    }
    return pickStyle(frames.length > 0 ? frames : photos.map(() => PLACEHOLDER_FRAME))
  }, [pickedStyleId, frames, photos])

  /** Auto-selected style, shown in the UI so the user knows why. */
  const autoStyle = useMemo(
    () => pickStyle(frames.length > 0 ? frames : photos.map(() => PLACEHOLDER_FRAME)),
    [frames, photos],
  )

  const [sheetSize, setSheetSize] = useState({ width: SHEET_WIDTH, height: 600 })
  /** Selected export resolution. */
  const [exportQuality, setExportQuality] = useState<ExportQualityId>('2x')
  /** True while an off-screen high-resolution render is in flight. */
  const [exporting, setExporting] = useState(false)

  /** Re-render the canvas whenever anything about the sheet changes. */
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !imagesReady) return
    renderPaper(canvas, {
      photos: frames,
      style,
      simulation: sim,
      caption,
      dateStamp,
      stickers,
      width: SHEET_WIDTH,
      seed: seedRef.current,
    })
    setSheetSize({
      width: parseFloat(canvas.style.width) || SHEET_WIDTH,
      height: parseFloat(canvas.style.height) || 600,
    })
  }, [frames, imagesReady, style, sim, caption, dateStamp, stickers])

  // Fonts must be ready or the handwritten caption renders with a fallback.
  useEffect(() => {
    let cancelled = false
    void document.fonts?.ready.then(() => {
      if (!cancelled) draw()
    })
    return () => {
      cancelled = true
    }
  }, [draw])

  // Draw whenever any dependency changes (images are pre-decoded above).
  useEffect(() => {
    draw()
  }, [draw])

  const handleDownload = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const stamp = dateStamp.replace(/\./g, '')
    const quality = EXPORT_QUALITIES.find((q) => q.id === exportQuality) ?? EXPORT_QUALITIES[1]!

    setExporting(true)
    try {
      // Render off-screen at the requested scale so the preview canvas is
      // never disturbed and the export is genuinely sharper, not upscaled.
      const out = document.createElement('canvas')
      renderPaper(out, {
        photos: frames,
        style,
        simulation: sim,
        caption,
        dateStamp,
        stickers,
        width: Math.round(SHEET_WIDTH * quality.scale),
        seed: seedRef.current,
      })
      downloadCanvas(out, `polaroid-${stamp}-${quality.id}.png`)
    } finally {
      setExporting(false)
    }
  }, [dateStamp, exportQuality, frames, style, sim, caption, stickers])

  const handleShare = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png')
    })
    if (!blob) return
    const file = new File([blob], `polaroid-${dateStamp.replace(/\./g, '')}.png`, {
      type: 'image/png',
    })
    const nav = navigator as Navigator & {
      canShare?: (data: { files: File[] }) => boolean
      share?: (data: { files: File[]; title: string }) => Promise<void>
    }
    if (nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: '我的拍立得' })
        return
      } catch {
        /* user cancelled — fall through to clipboard */
      }
    }
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    } catch {
      /* clipboard unavailable — the download button still works */
    }
  }, [dateStamp])

  const handleAddSticker = useCallback((defId: string) => {
    const def = STICKERS.find((s) => s.id === defId)
    if (!def) return
    setStickers((prev) => [
      ...prev,
      createStickerInstance(def, 0.5 + (Math.random() - 0.5) * 0.4, 0.3 + Math.random() * 0.4),
    ])
  }, [])

  const visibleStickers = useMemo(
    () => STICKERS.filter((s) => s.category === activeCategory),
    [activeCategory],
  )

  return (
    <div className="w-full max-w-6xl mx-auto px-5 pb-16 pt-6">
      {/* --- Header ------------------------------------------------------- */}
      <header className="mb-8 flex items-center justify-between gap-4">
        <button className="btn btn-ghost btn-sm" onClick={onBack} type="button">
          <ArrowLeftIcon size={16} />
          重新拍摄
        </button>
        <div className="text-center">
          <p className="stamp">DEVELOPING</p>
          <h2 className="font-display mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
            显影室
          </h2>
        </div>
        <button
          className="btn btn-accent btn-sm"
          onClick={() => {
            const canvas = canvasRef.current
            if (canvas) onFinish(canvas.toDataURL('image/png'), caption)
          }}
          type="button"
        >
          <CheckIconFallback />
          收入相册
        </button>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        {/* --- Preview ---------------------------------------------------- */}
        <div className="flex justify-center lg:sticky lg:top-8">
          <div className="relative">
            <div
              key={style.id}
              className={`strip-in relative ${isDeveloping ? 'developing' : ''}`}
              style={{ width: sheetSize.width, height: sheetSize.height }}
            >
              <canvas
                ref={canvasRef}
                className="block h-full w-full rounded-[2px]"
                style={{ width: sheetSize.width, height: sheetSize.height }}
              />

              {/* Sticker overlay sits exactly on the rendered sheet */}
              <StickerLayer
                items={stickers}
                onChange={setStickers}
                onRemove={(id) => setStickers((prev) => prev.filter((s) => s.id !== id))}
                width={sheetSize.width}
                height={sheetSize.height}
              />

              {/* The white bloom of fresh emulsion */}
              {isDeveloping && (
                <div className="bloom pointer-events-none absolute inset-0 rounded-[2px] bg-white" />
              )}
            </div>

            {/* Developed caption */}
            <div className="mt-6 flex flex-col items-center gap-3">
              {/* Export resolution */}
              <div className="flex items-center gap-1.5 rounded-full bg-paper/80 p-1 ring-1 ring-ink/10">
                {EXPORT_QUALITIES.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setExportQuality(q.id)}
                    aria-pressed={exportQuality === q.id}
                    title={q.note}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      exportQuality === q.id
                        ? 'bg-ink text-cream'
                        : 'text-ink-soft hover:bg-cream-deep'
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
                <span className="px-1.5 font-mono text-[9px] text-ink-faint">
                  {EXPORT_QUALITIES.find((q) => q.id === exportQuality)?.note.split(' · ')[0]}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => void handleDownload()}
                  disabled={exporting}
                  type="button"
                >
                  <DownloadIcon size={15} />
                  {exporting ? '导出中…' : '下载 PNG'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={handleShare} type="button">
                  <ShareIcon size={15} />
                  分享
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setIsDeveloping(false)
                    setTimeout(() => setIsDeveloping(true), 60)
                  }}
                  type="button"
                >
                  重放显影
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* --- Tools ------------------------------------------------------ */}
        <aside className="paper-card space-y-6 p-6">
          {/* Caption */}
          <div>
            <label
              htmlFor="caption"
              className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint"
            >
              <TextIcon size={14} />
              手写留言
            </label>
            <input
              id="caption"
              type="text"
              value={caption}
              maxLength={24}
              placeholder="今天很开心…"
              onChange={(e) => setCaption(e.target.value)}
              className="w-full rounded-md border border-ink/15 bg-cream px-3 py-2.5 text-lg focus:border-amber focus:outline-none"
              style={{ fontFamily: 'var(--font-hand)' }}
            />
            <p className="mt-1 text-right font-mono text-[10px] text-ink-faint">
              {caption.length} / 24
            </p>
          </div>

          <div className="rule" />

          {/* Film simulations */}
          <div>
            <div className="mb-2.5 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
              <FilterIcon size={14} />
              胶片模拟
            </div>
            <div className="grid max-h-52 grid-cols-3 gap-1.5 overflow-y-auto pr-1">
              {SIMULATIONS.map((s) => {
                const selected = s.id === sim
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onSimChange(s.id)}
                    aria-pressed={selected}
                    title={s.blurb}
                    className={`group flex flex-col items-center gap-1 rounded-md px-1 py-2 transition-all duration-200 ${
                      selected
                        ? 'bg-fuji-black text-white shadow-[0_2px_0_rgba(14,14,16,0.9)]'
                        : 'bg-cream-deep/70 text-ink-soft hover:-translate-y-0.5 hover:bg-cream-deep'
                    }`}
                  >
                    <span
                      className="h-4 w-4 rounded-full ring-1 ring-black/15 transition-transform duration-200 group-hover:scale-110"
                      style={{ background: s.swatch }}
                    />
                    <span className="font-mono text-[8.5px] leading-tight tracking-[0.02em]">
                      {s.name}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
              {SIMULATIONS.find((s) => s.id === sim)?.blurb}
            </p>
          </div>

          <div className="rule" />

          {/* Paper style */}
          <div>
            <div className="mb-2.5 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
              <PhotoIcon size={14} />
              相纸款式
              <span className="ml-auto text-[10px] normal-case tracking-normal text-ink-faint">
                {pickedStyleId ? '手动' : '自动'}
              </span>
            </div>

            <div className="mb-2 grid max-h-64 grid-cols-2 gap-1.5 overflow-y-auto pr-1">
              {PAPER_STYLES.map((s) => {
                const selected = s.id === style.id
                const auto = s.id === autoStyle.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setPickedStyleId(s.id)}
                    aria-pressed={selected}
                    title={s.theme?.blurb ?? ''}
                    className={`relative overflow-hidden rounded-md text-left transition-all duration-200 ${
                      selected
                        ? 'shadow-[0_0_0_2px_var(--color-ink),0_3px_0_rgba(14,14,16,0.85)]'
                        : 'hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(60,45,30,0.18)]'
                    }`}
                  >
                    {/* A miniature of the actual paper */}
                    <span
                      className="block h-9 w-full"
                      style={{ background: s.theme?.swatch ?? '#eee' }}
                    >
                      {/* little frame preview so the arrangement reads */}
                      <span className="flex h-full items-center justify-center gap-0.5">
                        {Array.from({ length: Math.min(s.prefers[0] ?? 1, 4) }, (_, i) => (
                          <span
                            key={i}
                            className="block rounded-[1px] bg-white/85 shadow-sm"
                            style={{ width: 7, height: 9 }}
                          />
                        ))}
                      </span>
                    </span>
                    <span
                      className={`flex items-center justify-between gap-1 px-1.5 py-1 ${
                        selected ? 'bg-fuji-black text-white' : 'bg-cream-deep/80 text-ink-soft'
                      }`}
                    >
                      <span className="truncate text-[10px] font-medium">{s.name}</span>
                      {auto && !pickedStyleId && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                      )}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] leading-relaxed text-ink-faint">
                {pickedStyleId
                  ? style.theme?.blurb
                  : `已按 ${photos.length} 张照片自动匹配`}
              </p>
              {pickedStyleId && (
                <button
                  type="button"
                  onClick={() => setPickedStyleId(null)}
                  className="inline-flex shrink-0 items-center gap-1 text-[10px] text-amber hover:underline"
                >
                  <SparkleIcon size={11} />
                  自动搭配
                </button>
              )}
            </div>
          </div>

          <div className="rule" />

          {/* Stickers */}
          <div>
            <div className="mb-2.5 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
              <StickerIcon size={14} />
              贴纸
              {stickers.length > 0 && (
                <button
                  type="button"
                  className="ml-auto inline-flex items-center gap-1 text-[10px] normal-case tracking-normal text-ink-faint transition-colors hover:text-amber"
                  onClick={() => setStickers([])}
                >
                  <TrashIcon size={12} />
                  清空
                </button>
              )}
            </div>

            {/* Category tabs — one per sticker pack */}
            <div className="mb-3 flex flex-wrap gap-1.5">
              {STICKER_CATEGORIES.map((cat) => {
                const hot = HOT_PACKS.has(cat.id)
                const active = activeCategory === cat.id
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    aria-pressed={active}
                    className={`relative rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                      active
                        ? 'bg-amber text-white'
                        : 'bg-cream-deep/70 text-ink-soft hover:bg-cream-deep'
                    }`}
                  >
                    {cat.label}
                    {hot && (
                      <span
                        className={`absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full ${
                          active ? 'bg-white' : 'bg-red-500'
                        }`}
                        aria-label="热门"
                      />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Sticker grid — captions render as mini bubbles */}
            <div className="grid max-h-52 grid-cols-3 gap-1.5 overflow-y-auto pr-1">
              {visibleStickers.map((s) => {
                const isCaption = s.kind === 'caption'
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleAddSticker(s.id)}
                    title={s.label}
                    aria-label={`添加贴纸 ${s.label}`}
                    className={`relative flex items-center justify-center rounded-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_10px_rgba(60,45,30,0.18)] ${
                      isCaption
                        ? 'min-h-[44px] px-1 py-1.5'
                        : 'aspect-square bg-cream-deep/60 text-xl hover:bg-cream-deep'
                    }`}
                    style={
                      isCaption
                        ? {
                            background: s.fill ?? '#fff',
                            border: `1px solid ${s.stroke ?? '#1b1815'}`,
                            color: s.color ?? '#1b1815',
                          }
                        : undefined
                    }
                  >
                    <span
                      className={
                        isCaption
                          ? 'whitespace-pre text-center text-[9px] font-bold leading-[1.25]'
                          : undefined
                      }
                    >
                      {s.glyph}
                    </span>
                    {s.hot && (
                      <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-red-500" />
                    )}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
              点击添加，然后直接在相纸上拖动、缩放或旋转。红点是当下最热门的梗。
            </p>
          </div>

          <div className="rule" />

          {/* Photo count */}
          <div className="flex items-center justify-between text-xs text-ink-faint">
            <span className="inline-flex items-center gap-1.5">
              <PhotoIcon size={14} />
              {photos.length} 张照片 · 一条相纸
            </span>
            <span className="font-mono">{dateStamp}</span>
          </div>
        </aside>
      </div>
    </div>
  )
}

/** Small local check icon so we do not import the whole icon set twice. */
function CheckIconFallback() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  )
}
