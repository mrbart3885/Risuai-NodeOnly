/**
 * Create a minimal seed backup (.bin) for testing.
 *
 * This builds a tiny but valid RisuAI backup containing one character with
 * one chat and one message, plus a handful of settings.  The binary format
 * mirrors what the real export endpoint produces.
 */
import { Packr } from 'msgpackr'
import { encodeBackup } from './encode.js'

// Must match the server's magic header for "raw" (uncompressed) format.
const MAGIC_RAW = Buffer.from([0, 82, 73, 83, 85, 83, 65, 86, 69, 0, 7])
const packr = new Packr({ useRecords: false })

function encodeRisuSaveLegacy(data: unknown): Buffer {
  const encoded = packr.encode(data)
  return Buffer.concat([MAGIC_RAW, encoded])
}

export interface SeedOptions {
  /** Number of characters to create (default 1). */
  characterCount?: number
  /** Number of chats per character (default 1). */
  chatsPerCharacter?: number
  /** Number of messages per chat (default 2). */
  messagesPerChat?: number
  /** Include dummy asset entries in the backup (default false). */
  includeAssets?: boolean
}

export function createSeedBackup(opts: SeedOptions = {}): Buffer {
  const {
    characterCount = 1,
    chatsPerCharacter = 1,
    messagesPerChat = 2,
    includeAssets = false,
  } = opts

  const characters = Array.from({ length: characterCount }, (_, ci) => {
    const chaId = `test-char-${ci}`
    const chats = Array.from({ length: chatsPerCharacter }, (_, chatIdx) => ({
      id: `chat-${ci}-${chatIdx}`,
      name: `Chat ${chatIdx}`,
      message: Array.from({ length: messagesPerChat }, (_, mi) => ({
        role: mi % 2 === 0 ? 'user' : 'char',
        data: `Message ${mi} in chat ${chatIdx} of char ${ci}`,
      })),
      lastDate: Date.now(),
      localLore: [],
      scriptstate: {},
      note: '',
    }))

    return {
      name: `TestCharacter${ci}`,
      chaId,
      desc: 'A test character',
      firstMessage: 'Hello!',
      chats,
      chatPage: 0,
      image: '',
      type: 'character',
    }
  })

  const database: Record<string, unknown> = {
    characters,
    apiType: 'openai',
    mainPrompt: '',
    jailbreak: '',
    globalNote: '',
    temperature: 80,
    maxContext: 4000,
    maxResponse: 300,
    frequencyPenalty: 70,
    PresensePenalty: 70,
    personas: [{ name: 'Default', icon: '', personaPrompt: '' }],
    botPresets: [],
    botPresetsId: 0,
    moduleIntergration: [],
    selectedCharacter: 0,
  }

  const dbBin = encodeRisuSaveLegacy(database)

  const entries: Array<{ name: string; data: Buffer }> = [
    { name: 'database.risudat', data: dbBin },
  ]

  if (includeAssets) {
    for (let i = 0; i < characterCount; i++) {
      // Asset entry names have no prefix — server prepends 'assets/' on import
      const hexKey = Buffer.from(`test-asset-${i}`).toString('hex')
      entries.push({ name: hexKey, data: Buffer.from(`fake-png-data-${i}`) })
    }
  }

  return encodeBackup(entries)
}
