export type ChatDraft = {
    messageInput: string
    messageInputTranslate: string
    fileInput: string[]
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const CHAT_DRAFT_PREFIX = 'risu:chat-draft:'

function normalizeDraft(draft: ChatDraft): ChatDraft {
    return {
        messageInput: draft.messageInput ?? '',
        messageInputTranslate: draft.messageInputTranslate ?? '',
        fileInput: Array.isArray(draft.fileInput) ? draft.fileInput.filter((value) => typeof value === 'string') : [],
    }
}

function isEmptyDraft(draft: ChatDraft): boolean {
    return draft.messageInput.trim() === '' &&
        draft.messageInputTranslate.trim() === '' &&
        draft.fileInput.length === 0
}

export function makeChatDraftStorageKey(characterId: string, chatId: string): string {
    return `${CHAT_DRAFT_PREFIX}${characterId}:${chatId}`
}

export function loadChatDraft(storage: StorageLike, characterId: string, chatId: string): ChatDraft | null {
    try {
        const raw = storage.getItem(makeChatDraftStorageKey(characterId, chatId))
        if (!raw) {
            return null
        }
        return normalizeDraft(JSON.parse(raw) as ChatDraft)
    } catch {
        return null
    }
}

export function saveChatDraft(storage: StorageLike, characterId: string, chatId: string, draft: ChatDraft): void {
    const normalized = normalizeDraft(draft)
    const storageKey = makeChatDraftStorageKey(characterId, chatId)

    if (isEmptyDraft(normalized)) {
        storage.removeItem(storageKey)
        return
    }

    storage.setItem(storageKey, JSON.stringify(normalized))
}

export function clearChatDraft(storage: StorageLike, characterId: string, chatId: string): void {
    storage.removeItem(makeChatDraftStorageKey(characterId, chatId))
}
