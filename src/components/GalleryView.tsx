import { useRef, useState } from 'react'

import {
  backupFilename,
  byteLength,
  createBackup,
  downloadText,
  formatBytes,
  mergeImport,
  parseBackup,
  serializeBackup,
  type ImportMode,
} from '../lib/backup'
import { DownloadIcon, GalleryIcon, ShareIcon, TrashIcon, UploadIcon } from './icons'

/** One saved strip in the album. */
export interface SavedStrip {
  id: string
  dataUrl: string
  caption: string
  createdAt: number
}

interface GalleryViewProps {
  strips: SavedStrip[]
  /** Start a new session. */
  onNew: () => void
  /** Remove a strip from the album. */
  onDelete: (id: string) => void
  /** Replace the whole album (used by backup import). */
  onRestore: (strips: SavedStrip[]) => void
  /** Return to the studio with a chosen strip loaded for editing. */
  onEdit?: (strip: SavedStrip) => void
}

/**
 * The album: every strip the user has saved, pinned to a corkboard.
 *
 * Includes backup export/import, because `localStorage` is easy to lose —
 * clearing site data or switching browsers would otherwise wipe everything.
 */
export function GalleryView({ strips, onNew, onDelete, onRestore }: GalleryViewProps) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const importRef = useRef<HTMLInputElement | null>(null)

  const flash = (msg: string) => {
    setNotice(msg)
    window.setTimeout(() => setNotice(null), 4000)
  }

  /** Write the whole album to a downloadable JSON file. */
  const handleExport = () => {
    if (strips.length === 0) {
      flash('相册是空的，没什么可导出的')
      return
    }
    const backup = createBackup(strips)
    const text = serializeBackup(backup)
    downloadText(text, backupFilename())
    flash(`已导出 ${strips.length} 张作品（${formatBytes(byteLength(text))}）`)
  }

  /** Read a backup file and merge or replace the album. */
  const handleImportFile = async (file: File) => {
    setBusy(true)
    try {
      const text = await file.text()
      const parsed = parseBackup(text)
      if (!parsed.ok) {
        flash(parsed.error ?? '导入失败')
        return
      }

      const mode: ImportMode = window.confirm(
        `备份里有 ${parsed.strips.length} 张作品。\n\n` +
          `点「确定」＝ 合并到现有相册（跳过重复）\n` +
          `点「取消」＝ 用备份完全替换现有相册`,
      )
        ? 'merge'
        : 'replace'

      const result = mergeImport(strips, parsed.strips, mode)
      onRestore(result.strips)

      const parts = [`已导入 ${result.added} 张`]
      if (result.skipped > 0) parts.push(`跳过重复 ${result.skipped} 张`)
      if (parsed.invalid > 0) parts.push(`忽略损坏 ${parsed.invalid} 张`)
      flash(parts.join('，'))
    } catch {
      flash('读取文件失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  const handleDownload = (strip: SavedStrip) => {
    const a = document.createElement('a')
    a.href = strip.dataUrl
    a.download = `polaroid-${strip.id}.png`
    a.click()
  }

  const handleShare = async (strip: SavedStrip) => {
    const blob = await new Promise<Blob | null>((resolve) => {
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas')
        c.width = img.naturalWidth
        c.height = img.naturalHeight
        const ctx = c.getContext('2d')
        ctx?.drawImage(img, 0, 0)
        c.toBlob((b) => resolve(b), 'image/png')
      }
      img.onerror = () => resolve(null)
      img.src = strip.dataUrl
    })
    if (!blob) return
    const file = new File([blob], `polaroid-${strip.id}.png`, { type: 'image/png' })
    const nav = navigator as Navigator & {
      canShare?: (d: { files: File[] }) => boolean
      share?: (d: { files: File[] }) => Promise<void>
    }
    if (nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file] })
        return
      } catch {
        /* cancelled */
      }
    }
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-5 pb-16 pt-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="stamp">THE ALBUM</p>
          <h2 className="font-display mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
            我的相册
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleExport}
            disabled={busy}
            type="button"
            title="把所有作品导出成一个 JSON 备份文件"
          >
            <DownloadIcon size={15} />
            导出备份
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => importRef.current?.click()}
            disabled={busy}
            type="button"
            title="从备份文件恢复作品"
          >
            <UploadIcon size={15} />
            导入备份
          </button>
          <button className="btn btn-accent btn-sm" onClick={onNew} type="button">
            <GalleryIcon size={15} />
            拍新的
          </button>
        </div>
      </header>

      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleImportFile(f)
          e.target.value = ''
        }}
      />

      {/* Transient status line */}
      {notice && (
        <div className="mb-4 rounded-md border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-ink-soft">
          {notice}
        </div>
      )}

      {strips.length === 0 ? (
        <div className="paper-card flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
          <GalleryIcon size={40} className="text-ink-faint" />
          <p className="font-display text-xl">相册还是空的</p>
          <p className="max-w-sm text-sm leading-relaxed text-ink-faint">
            拍一条拍立得吧——它会像真照片一样，先慢慢显影，再被收进这里。
          </p>
          <button className="btn btn-primary mt-2" onClick={onNew} type="button">
            开始拍照
          </button>
        </div>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {strips.map((strip, i) => (
            <article
              key={strip.id}
              className="group relative"
              style={{ '--sway': `${((i % 3) - 1) * 2.4}deg` } as React.CSSProperties}
            >
              <div
                className="sway relative overflow-hidden rounded-[3px] bg-white p-3 pb-10 shadow-[0_2px_4px_rgba(60,45,30,0.1),0_14px_32px_rgba(60,45,30,0.18)] transition-shadow duration-300 group-hover:shadow-[0_4px_8px_rgba(60,45,30,0.12),0_24px_56px_rgba(60,45,30,0.28)]"
              >
                <img
                  src={strip.dataUrl}
                  alt={strip.caption || '拍立得照片'}
                  className="block w-full rounded-[2px] bg-cream-deep object-contain"
                />

                {/* Caption area */}
                <div className="absolute inset-x-3 bottom-2 flex items-end justify-between gap-2">
                  <p className="writing truncate text-xl" title={strip.caption}>
                    {strip.caption || '—'}
                  </p>
                  <span className="font-mono text-[9px] text-ink-faint">
                    {new Date(strip.createdAt).toLocaleDateString('zh-CN', {
                      year: '2-digit',
                      month: '2-digit',
                      day: '2-digit',
                    })}
                  </span>
                </div>

                {/* Hover actions */}
                <div
                  className={`absolute right-4 top-5 flex gap-1.5 transition-opacity duration-200 ${
                    hovered === strip.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  onMouseEnter={() => setHovered(strip.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <button
                    type="button"
                    className="icon-btn !h-8 !w-8 !bg-white/95"
                    aria-label="下载"
                    onClick={() => handleDownload(strip)}
                  >
                    <DownloadIcon size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn !h-8 !w-8 !bg-white/95"
                    aria-label="分享"
                    onClick={() => void handleShare(strip)}
                  >
                    <ShareIcon size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn !h-8 !w-8 !bg-white/95 !text-amber-deep"
                    aria-label="删除"
                    onClick={() => onDelete(strip.id)}
                  >
                    <TrashIcon size={15} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
