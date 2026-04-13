/**
 * Cold storage compatibility tests.
 *
 * Tests the one-time migration path: upstream backup with cold storage
 * characters → NodeOnly import → characters restored inline.
 */
import { describe, test, expect, afterAll } from 'vitest'
import { spawnServer, type ServerHandle } from './helpers/spawnServer.js'
import { createClient } from './helpers/client.js'
import { createSeedBackup } from './helpers/seed.js'
import { normalizeBackup } from './helpers/normalize.js'

const servers: ServerHandle[] = []
afterAll(async () => {
  await Promise.allSettled(servers.map(s => s.cleanup()))
})

describe('character cold storage migration', () => {

  test('restores cold storage character from upstream backup', async () => {
    const srv = await spawnServer()
    servers.push(srv)
    const client = await createClient(srv.port, srv.password)

    // Build a backup with one normal char + one cold storage char
    const fullCharData = {
      character: {
        name: 'ColdChar',
        chaId: 'cold-char-cs-key-1',
        image: '',
        type: 'character',
        desc: 'A restored character',
        firstMessage: 'Hello from cold storage!',
        chats: [{
          message: [{ role: 'char', data: 'Hello from cold storage!' }],
          note: '', name: 'Chat 1', localLore: [],
        }],
        chatPage: 0,
        firstMsgIndex: -1,
        notes: '', emotionImages: [], bias: [], globalLore: [],
        viewScreen: 'none', sdData: [], utilityBot: false,
        customscript: [], triggerscript: [],
        exampleMessage: '', creatorNotes: '', systemPrompt: '',
        postHistoryInstructions: '', alternateGreetings: [],
        tags: [], creator: '', characterVersion: '',
        personality: '', scenario: '', replaceGlobalNote: '',
        additionalText: '', chatFolders: [],
      },
    }

    const seed = createSeedBackup({
      characterCount: 1,
      coldStorageCharacters: [
        { name: 'ColdChar', coldKey: 'cs-key-1', fullData: fullCharData },
      ],
    })

    const result = await client.importBackup(seed)
    expect(result.ok).toBe(true)
    expect(result.coldStorageFailed ?? 0).toBe(0)

    // Export and verify the cold storage character was restored
    const exportBin = await client.exportBackup()
    const { normalized } = normalizeBackup(exportBin)

    const coldChar = normalized.characters.find(c => c.chaId === 'cold-char-cs-key-1')
    expect(coldChar).toBeDefined()
    expect(coldChar!.name).toBe('ColdChar')
    // Should have the restored chat, not the stub placeholder
    expect(coldChar!.messageCounts[0]).toBeGreaterThan(0)
    expect(coldChar!.firstMessages[0]).toBe('Hello from cold storage!')
  })

  test('promotes failed cold storage character to blank with recovery info', async () => {
    const srv = await spawnServer()
    servers.push(srv)
    const client = await createClient(srv.port, srv.password)

    // Build a backup with a cold storage stub but NO corresponding KV entry
    const seed = createSeedBackup({
      characterCount: 1,
      coldStorageCharacters: [
        { name: 'BrokenChar', coldKey: 'missing-key', fullData: null },
      ],
    })

    const result = await client.importBackup(seed)
    expect(result.ok).toBe(true)
    expect(result.coldStorageFailed).toBe(1)

    // Export and verify the character was promoted to blank (not deleted)
    const exportBin = await client.exportBackup()
    const { raw } = normalizeBackup(exportBin)
    const chars = raw.characters as any[]

    const brokenChar = chars.find((c: any) => c.chaId === 'cold-char-missing-key')
    expect(brokenChar).toBeDefined()
    expect(brokenChar.name).toBe('BrokenChar')
    // coldstorage field should be gone
    expect(brokenChar.coldstorage).toBeUndefined()
    // desc should contain recovery key
    expect(brokenChar.desc).toContain('missing-key')
    expect(brokenChar.desc).toContain('Cold storage restore failed')
    // firstMsgIndex should be -1 (safe default)
    expect(brokenChar.firstMsgIndex).toBe(-1)
    // Should have valid structure (not crash-prone stub)
    expect(Array.isArray(brokenChar.globalLore)).toBe(true)
    expect(Array.isArray(brokenChar.bias)).toBe(true)
    expect(Array.isArray(brokenChar.emotionImages)).toBe(true)
  })

  test('cold storage round-trip: import → export preserves cold storage KV entries', async () => {
    const srv = await spawnServer()
    servers.push(srv)
    const client = await createClient(srv.port, srv.password)

    const fullCharData = {
      character: {
        name: 'RoundTripChar',
        chaId: 'cold-char-rt-key',
        image: '', type: 'character',
        desc: 'Round trip test',
        firstMessage: 'RT hello',
        chats: [{ message: [{ role: 'char', data: 'RT hello' }], note: '', name: 'Chat 1', localLore: [] }],
        chatPage: 0, firstMsgIndex: -1,
        notes: '', emotionImages: [], bias: [], globalLore: [],
        viewScreen: 'none', sdData: [], utilityBot: false,
        customscript: [], triggerscript: [],
        exampleMessage: '', creatorNotes: '', systemPrompt: '',
        postHistoryInstructions: '', alternateGreetings: [],
        tags: [], creator: '', characterVersion: '',
        personality: '', scenario: '', replaceGlobalNote: '',
        additionalText: '', chatFolders: [],
      },
    }

    const seed = createSeedBackup({
      characterCount: 0,
      coldStorageCharacters: [
        { name: 'RoundTripChar', coldKey: 'rt-key', fullData: fullCharData },
      ],
    })

    await client.importBackup(seed)

    // Server A export → Server B import → Server B export → compare
    const exportA = await client.exportBackup()

    const srvB = await spawnServer()
    servers.push(srvB)
    const clientB = await createClient(srvB.port, srvB.password)
    await clientB.importBackup(exportA)
    const exportB = await clientB.exportBackup()

    const normA = normalizeBackup(exportA)
    const normB = normalizeBackup(exportB)

    const charA = normA.normalized.characters.find(c => c.chaId === 'cold-char-rt-key')
    const charB = normB.normalized.characters.find(c => c.chaId === 'cold-char-rt-key')
    expect(charA).toBeDefined()
    expect(charB).toBeDefined()
    expect(charA!.name).toBe(charB!.name)
    expect(charA!.firstMessages).toEqual(charB!.firstMessages)
  })
})
