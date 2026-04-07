import { describe, expect, test } from 'vitest'
import {
    clearChatDraft,
    loadChatDraft,
    makeChatDraftStorageKey,
    saveChatDraft,
    type ChatDraft,
    type StorageLike,
} from './chatDraft'

class MemoryStorage implements StorageLike {
    private readonly data = new Map<string, string>()

    getItem(key: string): string | null {
        return this.data.has(key) ? this.data.get(key)! : null
    }

    setItem(key: string, value: string): void {
        this.data.set(key, value)
    }

    removeItem(key: string): void {
        this.data.delete(key)
    }
}

const draft: ChatDraft = {
    messageInput: 'hello',
    messageInputTranslate: 'annyeong',
    fileInput: ['asset-1', 'asset-2'],
}

describe('chatDraft', () => {
    test('creates a stable storage key per character/chat pair', () => {
        expect(makeChatDraftStorageKey('char-1', 'chat-1')).toBe('risu:chat-draft:char-1:chat-1')
    })

    test('saves and loads a chat draft', () => {
        const storage = new MemoryStorage()

        saveChatDraft(storage, 'char-1', 'chat-1', draft)

        expect(loadChatDraft(storage, 'char-1', 'chat-1')).toEqual(draft)
    })

    test('removes a draft when every field is empty', () => {
        const storage = new MemoryStorage()

        saveChatDraft(storage, 'char-1', 'chat-1', draft)
        saveChatDraft(storage, 'char-1', 'chat-1', {
            messageInput: '   ',
            messageInputTranslate: '',
            fileInput: [],
        })

        expect(loadChatDraft(storage, 'char-1', 'chat-1')).toBeNull()
    })

    test('returns null for malformed persisted drafts', () => {
        const storage = new MemoryStorage()
        storage.setItem(makeChatDraftStorageKey('char-1', 'chat-1'), '{broken')

        expect(loadChatDraft(storage, 'char-1', 'chat-1')).toBeNull()
    })

    test('clears a persisted draft explicitly', () => {
        const storage = new MemoryStorage()

        saveChatDraft(storage, 'char-1', 'chat-1', draft)
        clearChatDraft(storage, 'char-1', 'chat-1')

        expect(loadChatDraft(storage, 'char-1', 'chat-1')).toBeNull()
    })
})
