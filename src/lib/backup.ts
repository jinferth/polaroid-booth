/**
 * Album backup: export the whole gallery to a portable JSON file, and import
 * one back.
 *
 * The album lives in `localStorage`, which is per-browser and easy to lose —
 * clearing site data, switching browsers, or using a different machine all
 * wipe it. This module is the escape hatch.
 *
 * Format (versioned so future changes can migrate):
 *
 * ```json
 * {
 *   "format": "polaroid-booth-backup",
 *   "version": 1,
 *   "exportedAt": "2026-10-27T10:00:00.000Z",
 *   "strips": [ { "id": "...", "dataUrl": "data:image/png;base64,...", ... } ]
 * }
 * ```
 */

/** One saved strip, as stored in the album. */
export interface BackupStrip {
  id: string
  dataUrl: string
  caption: string
  createdAt: number
}

export interface BackupFile {
  format: 'polaroid-booth-backup'
  version: 1
  exportedAt: string
  strips: BackupStrip[]
}

export const BACKUP_FORMAT = 'polaroid-booth-backup'
export const BACKUP_VERSION = 1

/** How an import should treat strips that already exist. */
export type ImportMode = 'merge' | 'replace'

export interface ImportResult {
  /** Strips to keep after the import. */
  strips: BackupStrip[]
  /** How many were newly added (0 for a pure replace). */
  added: number
  /** How many were skipped because the id already existed. */
  skipped: number
  /** Strips in the file that failed validation. */
  invalid: number
}

/** Build the backup object for a set of strips. */
export function createBackup(strips: readonly BackupStrip[], now = new Date()): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    strips: strips.map((s) => ({
      id: s.id,
      dataUrl: s.dataUrl,
      caption: s.caption,
      createdAt: s.createdAt,
    })),
  }
}

/** Serialise a backup to a pretty-printed JSON string. */
export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2)
}

/** A human-readable size for a backup, e.g. "3.4 MB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i += 1
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

/** Approximate the byte size of a string as UTF-8. */
export function byteLength(text: string): number {
  // Blob is the accurate way and is available everywhere we run.
  try {
    return new Blob([text]).size
  } catch {
    return text.length
  }
}

/** Is this a data URL that looks like an image? */
function isImageDataUrl(v: unknown): v is string {
  return typeof v === 'string' && v.startsWith('data:image/')
}

/** Validate and narrow one unknown entry from a parsed file. */
function parseStrip(raw: unknown): BackupStrip | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || o.id.length === 0) return null
  if (!isImageDataUrl(o.dataUrl)) return null
  const caption = typeof o.caption === 'string' ? o.caption : ''
  const createdAt =
    typeof o.createdAt === 'number' && Number.isFinite(o.createdAt) ? o.createdAt : Date.now()
  return { id: o.id, dataUrl: o.dataUrl, caption, createdAt }
}

export interface ParseResult {
  ok: boolean
  /** Present when `ok` is false. */
  error?: string
  strips: BackupStrip[]
  invalid: number
}

/**
 * Parse a backup file's text.
 *
 * Never throws: a malformed file produces `{ ok: false, error }` so the UI can
 * show a friendly message instead of crashing the app.
 */
export function parseBackup(text: string): ParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: '这不是有效的 JSON 文件', strips: [], invalid: 0 }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: '备份文件内容格式不对', strips: [], invalid: 0 }
  }

  const obj = parsed as Record<string, unknown>

  // Accept both the versioned wrapper and a bare array (hand-edited files).
  const rawStrips = Array.isArray(obj.strips)
    ? obj.strips
    : Array.isArray(parsed)
      ? parsed
      : null

  if (!rawStrips) {
    return { ok: false, error: '备份文件里没有找到作品列表', strips: [], invalid: 0 }
  }

  const strips: BackupStrip[] = []
  let invalid = 0
  for (const raw of rawStrips) {
    const strip = parseStrip(raw)
    if (strip) strips.push(strip)
    else invalid += 1
  }

  if (strips.length === 0) {
    return {
      ok: false,
      error: invalid > 0 ? '备份里的作品都读不出来（可能已损坏）' : '备份里没有作品',
      strips: [],
      invalid,
    }
  }

  return { ok: true, strips, invalid }
}

/**
 * Merge imported strips into the existing album.
 *
 * `merge` keeps everything and appends only new ids (newest first).
 * `replace` discards the current album entirely.
 */
export function mergeImport(
  existing: readonly BackupStrip[],
  incoming: readonly BackupStrip[],
  mode: ImportMode,
): ImportResult {
  if (mode === 'replace') {
    // De-duplicate within the incoming file itself.
    const seen = new Set<string>()
    const unique: BackupStrip[] = []
    for (const s of incoming) {
      if (seen.has(s.id)) continue
      seen.add(s.id)
      unique.push(s)
    }
    return { strips: unique, added: unique.length, skipped: 0, invalid: 0 }
  }

  const existingIds = new Set(existing.map((s) => s.id))
  const added: BackupStrip[] = []
  let skipped = 0
  for (const s of incoming) {
    if (existingIds.has(s.id)) {
      skipped += 1
      continue
    }
    existingIds.add(s.id)
    added.push(s)
  }

  return {
    strips: [...added, ...existing],
    added: added.length,
    skipped,
    invalid: 0,
  }
}

/** Suggested filename for a backup, e.g. `polaroid-backup-2026-10-27.json`. */
export function backupFilename(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `polaroid-backup-${y}-${m}-${d}.json`
}

/** Trigger a download of the given text as a file. */
export function downloadText(text: string, filename: string, mime = 'application/json'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
