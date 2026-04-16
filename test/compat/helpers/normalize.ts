/**
 * Decode the database.risudat entry from a backup and normalize it for
 * semantic comparison (order-independent, timestamp-independent).
 */
import { Unpackr } from 'msgpackr'
import { decodeBackup } from './decode.js'

// Magic header: \0RISUSAVE\0\x07  (11 bytes, "raw" / no-compression variant)
const MAGIC_RAW = Buffer.from([0, 82, 73, 83, 85, 83, 65, 86, 69, 0, 7])
// Compressed variant: same prefix but byte 10 = 0x08
const MAGIC_COMPRESSED = Buffer.from([0, 82, 73, 83, 85, 83, 65, 86, 69, 0, 8])

const unpackr = new Unpackr({ int64AsType: 'number', useRecords: false })

/** Decode a database.risudat binary blob (magic-header + msgpackr). */
export function decodeRisuDat(buf: Buffer): Record<string, unknown> {
  if (buf.subarray(0, MAGIC_RAW.length).equals(MAGIC_RAW)) {
    return unpackr.decode(buf.subarray(MAGIC_RAW.length))
  }
  if (buf.subarray(0, MAGIC_COMPRESSED.length).equals(MAGIC_COMPRESSED)) {
    // Compressed variant — use fflate
    const fflate = require('fflate') as typeof import('fflate')
    const decompressed = fflate.decompressSync(buf.subarray(MAGIC_COMPRESSED.length))
    return unpackr.decode(Buffer.from(decompressed))
  }
  // Fallback: try raw msgpackr
  return unpackr.decode(buf)
}

/** Compact summary of a backup's database — just enough to catch regressions. */
export interface NormalizedDb {
  characterCount: number
  characters: Array<{
    name: string
    chaId: string
    chatCount: number
    messageCounts: number[]  // message count per chat
    /** First and last message text of each chat (content spot-check). */
    firstMessages: string[]
    lastMessages: string[]
  }>
  personaCount: number
  /** Sorted list of top-level setting keys that are present. */
  settingKeys: string[]
}

export function normalizeDatabase(db: Record<string, unknown>): NormalizedDb {
  const chars = Array.isArray(db.characters) ? db.characters : []

  const characters = chars
    .filter((c: any) => c && typeof c === 'object')
    .map((c: any) => ({
      name: String(c.name ?? ''),
      chaId: String(c.chaId ?? ''),
      chatCount: Array.isArray(c.chats) ? c.chats.length : 0,
      messageCounts: Array.isArray(c.chats)
        ? c.chats.map((chat: any) =>
            Array.isArray(chat?.message) ? chat.message.length : 0,
          )
        : [],
      firstMessages: Array.isArray(c.chats)
        ? c.chats.map((chat: any) => {
            const msgs = Array.isArray(chat?.message) ? chat.message : []
            return msgs.length > 0 ? String(msgs[0]?.data ?? '') : ''
          })
        : [],
      lastMessages: Array.isArray(c.chats)
        ? c.chats.map((chat: any) => {
            const msgs = Array.isArray(chat?.message) ? chat.message : []
            return msgs.length > 0 ? String(msgs[msgs.length - 1]?.data ?? '') : ''
          })
        : [],
    }))
    .sort((a, b) => a.chaId.localeCompare(b.chaId))

  const personas = Array.isArray((db as any).personas) ? (db as any).personas : []

  const settingKeys = Object.keys(db)
    .filter(k => k !== 'characters')
    .sort()

  return {
    characterCount: characters.length,
    characters,
    personaCount: personas.length,
    settingKeys,
  }
}

/**
 * Convenience: decode a full .bin backup, extract database.risudat, and
 * return both the raw decoded DB object and its normalized form.
 */
export function normalizeBackup(bin: Buffer): { raw: Record<string, unknown>; normalized: NormalizedDb } {
  const entries = decodeBackup(bin)
  const dbEntry = entries.find(e => e.name === 'database.risudat')
  if (!dbEntry) throw new Error('Backup does not contain database.risudat')
  const raw = decodeRisuDat(dbEntry.data)
  return { raw, normalized: normalizeDatabase(raw) }
}

/** Asset fingerprint: name + sha256 of payload. Sorted for stable comparison. */
export interface AssetFingerprint {
  name: string
  hash: string
}

export function fingerprintAssets(bin: Buffer): AssetFingerprint[] {
  const { createHash } = require('node:crypto') as typeof import('node:crypto')
  return decodeBackup(bin)
    .filter(e => e.name !== 'database.risudat')
    .map(e => ({
      name: e.name,
      hash: createHash('sha256').update(e.data).digest('hex'),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
