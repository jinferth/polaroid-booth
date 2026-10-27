import { describe, expect, it } from 'vitest'

import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupFilename,
  byteLength,
  createBackup,
  formatBytes,
  mergeImport,
  parseBackup,
  serializeBackup,
  type BackupStrip,
} from '../src/lib/backup'

const strip = (id: string, caption = ''): BackupStrip => ({
  id,
  dataUrl: `data:image/png;base64,AAAA${id}`,
  caption,
  createdAt: 1700000000000,
})

describe('createBackup', () => {
  it('wraps strips in a versioned envelope', () => {
    const b = createBackup([strip('a'), strip('b')])
    expect(b.format).toBe(BACKUP_FORMAT)
    expect(b.version).toBe(BACKUP_VERSION)
    expect(b.strips).toHaveLength(2)
    expect(typeof b.exportedAt).toBe('string')
    // Must be a parseable ISO timestamp.
    expect(Number.isNaN(Date.parse(b.exportedAt))).toBe(false)
  })

  it('handles an empty album', () => {
    const b = createBackup([])
    expect(b.strips).toHaveLength(0)
  })

  it('does not mutate the input', () => {
    const input = [strip('a')]
    createBackup(input)
    expect(input).toHaveLength(1)
  })
})

describe('serialize + parse round-trip', () => {
  it('survives a full round-trip', () => {
    const original = [strip('a', '今天'), strip('b', '快乐')]
    const text = serializeBackup(createBackup(original))
    const parsed = parseBackup(text)
    expect(parsed.ok).toBe(true)
    expect(parsed.strips).toHaveLength(2)
    expect(parsed.strips[0]?.caption).toBe('今天')
    expect(parsed.strips[1]?.id).toBe('b')
  })

  it('produces readable JSON', () => {
    const text = serializeBackup(createBackup([strip('a')]))
    expect(text).toContain('\n')
    expect(() => JSON.parse(text)).not.toThrow()
  })
})

describe('parseBackup — malformed input', () => {
  it('rejects invalid JSON without throwing', () => {
    const r = parseBackup('{not json')
    expect(r.ok).toBe(false)
    expect(r.error).toBeTruthy()
  })

  it('rejects a JSON value with no strips', () => {
    expect(parseBackup('{"hello":1}').ok).toBe(false)
    expect(parseBackup('null').ok).toBe(false)
    expect(parseBackup('42').ok).toBe(false)
  })

  it('reports when every entry is corrupt', () => {
    const r = parseBackup(JSON.stringify({ strips: [{ nope: true }, { id: 5 }] }))
    expect(r.ok).toBe(false)
    expect(r.invalid).toBe(2)
  })

  it('skips individual corrupt entries but keeps the good ones', () => {
    const good = strip('good')
    const r = parseBackup(
      JSON.stringify({ strips: [good, { id: 'x' }, { id: 'y', dataUrl: 'http://evil' }] }),
    )
    expect(r.ok).toBe(true)
    expect(r.strips).toHaveLength(1)
    expect(r.strips[0]?.id).toBe('good')
    expect(r.invalid).toBe(2)
  })

  it('rejects a dataUrl that is not an image', () => {
    const r = parseBackup(
      JSON.stringify({ strips: [{ id: 'a', dataUrl: 'javascript:alert(1)' }] }),
    )
    expect(r.ok).toBe(false)
  })

  it('accepts a bare array (hand-edited file)', () => {
    const r = parseBackup(JSON.stringify([strip('a')]))
    expect(r.ok).toBe(true)
    expect(r.strips).toHaveLength(1)
  })

  it('defaults a missing caption and createdAt', () => {
    const r = parseBackup(
      JSON.stringify({ strips: [{ id: 'a', dataUrl: 'data:image/png;base64,ZZ' }] }),
    )
    expect(r.ok).toBe(true)
    expect(r.strips[0]?.caption).toBe('')
    expect(typeof r.strips[0]?.createdAt).toBe('number')
  })
})

describe('mergeImport — merge mode', () => {
  it('appends new strips ahead of existing ones', () => {
    const existing = [strip('a'), strip('b')]
    const incoming = [strip('c')]
    const r = mergeImport(existing, incoming, 'merge')
    expect(r.added).toBe(1)
    expect(r.skipped).toBe(0)
    expect(r.strips).toHaveLength(3)
    expect(r.strips[0]?.id).toBe('c')
  })

  it('skips strips whose id already exists', () => {
    const existing = [strip('a'), strip('b')]
    const r = mergeImport(existing, [strip('b'), strip('c')], 'merge')
    expect(r.added).toBe(1)
    expect(r.skipped).toBe(1)
    expect(r.strips).toHaveLength(3)
  })

  it('does not duplicate an id repeated inside the incoming file', () => {
    const r = mergeImport([], [strip('a'), strip('a')], 'merge')
    expect(r.added).toBe(1)
    expect(r.strips).toHaveLength(1)
  })

  it('is a no-op when everything is a duplicate', () => {
    const existing = [strip('a')]
    const r = mergeImport(existing, [strip('a')], 'merge')
    expect(r.added).toBe(0)
    expect(r.strips).toHaveLength(1)
  })
})

describe('mergeImport — replace mode', () => {
  it('discards the existing album entirely', () => {
    const r = mergeImport([strip('a'), strip('b')], [strip('z')], 'replace')
    expect(r.strips).toHaveLength(1)
    expect(r.strips[0]?.id).toBe('z')
  })

  it('de-duplicates within the incoming file', () => {
    const r = mergeImport([], [strip('a'), strip('a'), strip('b')], 'replace')
    expect(r.strips).toHaveLength(2)
  })

  it('can replace with an empty album', () => {
    const r = mergeImport([strip('a')], [], 'replace')
    expect(r.strips).toHaveLength(0)
  })
})

describe('formatBytes', () => {
  it('formats each unit sensibly', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toMatch(/KB/)
    expect(formatBytes(5 * 1024 * 1024)).toMatch(/MB/)
  })

  it('is defensive about bad input', () => {
    expect(formatBytes(-1)).toBe('0 B')
    expect(formatBytes(NaN)).toBe('0 B')
  })
})

describe('byteLength', () => {
  it('counts multi-byte characters correctly', () => {
    // Chinese characters are 3 bytes each in UTF-8.
    expect(byteLength('中')).toBe(3)
    expect(byteLength('abc')).toBe(3)
  })
})

describe('backupFilename', () => {
  it('includes the date and ends in .json', () => {
    const name = backupFilename(new Date('2026-10-27T10:00:00Z'))
    expect(name).toMatch(/^polaroid-backup-\d{4}-\d{2}-\d{2}\.json$/)
  })
})
