/**
 * Upstream backup import tests.
 *
 * Verifies that a .bin backup exported from upstream RisuAI can be
 * imported into NodeOnly and that core data survives a round-trip.
 *
 * Requires: test/fixtures/upstream/upstream-backup.bin
 * (not tracked in git — see .gitignore)
 */
import { describe, test, expect, afterAll } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { spawnServer, type ServerHandle } from './helpers/spawnServer.js'
import { createClient } from './helpers/client.js'
import { normalizeBackup, fingerprintAssets } from './helpers/normalize.js'

const FIXTURE_PATH = path.resolve(
  import.meta.dirname, '..', 'fixtures', 'upstream', 'upstream-backup.bin',
)
const HAS_FIXTURE = existsSync(FIXTURE_PATH)

const servers: ServerHandle[] = []
afterAll(async () => {
  await Promise.allSettled(servers.map(s => s.cleanup()))
})

describe.skipIf(!HAS_FIXTURE)('upstream backup import', () => {
  let upstreamBin: Buffer

  test('fixture file is readable', () => {
    upstreamBin = readFileSync(FIXTURE_PATH)
    expect(upstreamBin.length).toBeGreaterThan(0)
  })

  test('upstream .bin can be decoded locally', () => {
    upstreamBin = upstreamBin ?? readFileSync(FIXTURE_PATH)
    const { normalized } = normalizeBackup(upstreamBin)
    expect(normalized.characterCount).toBeGreaterThan(0)
  })

  test('upstream .bin imports into NodeOnly server', async () => {
    upstreamBin = upstreamBin ?? readFileSync(FIXTURE_PATH)
    const srv = await spawnServer()
    servers.push(srv)
    const client = await createClient(srv.port, srv.password)

    const result = await client.importBackup(upstreamBin)
    expect(result.ok).toBe(true)
  })

  test('imported upstream data survives re-export', async () => {
    upstreamBin = upstreamBin ?? readFileSync(FIXTURE_PATH)
    const before = normalizeBackup(upstreamBin)

    const srv = await spawnServer()
    servers.push(srv)
    const client = await createClient(srv.port, srv.password)

    await client.importBackup(upstreamBin)
    const exported = await client.exportBackup()
    const after = normalizeBackup(exported)

    // Character count must match
    expect(after.normalized.characterCount).toBe(before.normalized.characterCount)

    // Each character's name, chat count, and message content must survive
    for (const beforeChar of before.normalized.characters) {
      const afterChar = after.normalized.characters.find(c => c.chaId === beforeChar.chaId)
      expect(afterChar, `character ${beforeChar.name} (${beforeChar.chaId}) missing after import`).toBeDefined()
      expect(afterChar!.name).toBe(beforeChar.name)
      expect(afterChar!.chatCount).toBe(beforeChar.chatCount)
      expect(afterChar!.firstMessages).toEqual(beforeChar.firstMessages)
    }

    // Persona count must survive
    expect(after.normalized.personaCount).toBe(before.normalized.personaCount)
  })

  test('upstream assets survive import with intact payload', async () => {
    upstreamBin = upstreamBin ?? readFileSync(FIXTURE_PATH)
    const beforeFingerprints = fingerprintAssets(upstreamBin)

    const srv = await spawnServer()
    servers.push(srv)
    const client = await createClient(srv.port, srv.password)

    await client.importBackup(upstreamBin)
    const exported = await client.exportBackup()
    const afterFingerprints = fingerprintAssets(exported)

    // Count and payload hashes must all match
    expect(afterFingerprints.length).toBe(beforeFingerprints.length)
    expect(afterFingerprints).toEqual(beforeFingerprints)
  })
})
