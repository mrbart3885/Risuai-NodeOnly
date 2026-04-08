import { forageStorage } from "../globalApi.svelte"
import { type Chat, type ChatStub, type ChatOrStub, isChatStub } from "./database.svelte"
import { tick } from "svelte"

// ── Stub ↔ Placeholder conversion ───────────────────────────────────────────

/**
 * Convert a ChatStub to a placeholder Chat with safe empty defaults.
 * The placeholder passes all Chat type checks so existing code works unchanged.
 * `_placeholder: true` marks it for hydration and dirty-tracking suppression.
 */
export function stubToPlaceholder(stub: ChatStub): Chat {
    return {
        message: [],
        note: '',
        name: stub.name,
        localLore: [],
        id: stub.id,
        lastDate: stub.lastDate,
        folderId: stub.folderId,
        _placeholder: true,
    }
}

/**
 * Convert a Chat (or placeholder) to a ChatStub for database.bin encoding.
 */
export function chatToStub(chat: Chat | ChatStub): ChatStub {
    if (isChatStub(chat)) return chat
    return {
        id: chat.id ?? '',
        name: chat.name,
        lastDate: chat.lastDate,
        folderId: chat.folderId,
        _stub: true,
    }
}

/**
 * Replace all ChatStubs in a character's chats array with placeholder Chats.
 * Call this once after decoding database.bin so runtime code only sees Chat objects.
 */
export function convertStubsToPlaceholders(chats: ChatOrStub[]): Chat[] {
    return chats.map(c => isChatStub(c) ? stubToPlaceholder(c) : c)
}

// ── Hydration state ──────────────────────────────────────────────────────────

function chatKey(chaId: string, chatId: string): string {
    return `${chaId}/${chatId}`
}

/** Hydration in progress — suppress dirty tracking */
export const hydrationInFlight = new Set<string>()

/** Hydration just applied to memory — suppress until next tick */
export const hydrationJustApplied = new Set<string>()

/** Track in-flight hydration promises to avoid duplicate fetches */
const hydrationPromises = new Map<string, Promise<Chat | null>>()

// ── Server fetch/save ───────────────────────────────────────────────────────

export async function fetchChatFromServer(chaId: string, chatIndex: number, chatId: string): Promise<Chat | null> {
    const storage = forageStorage.realStorage
    return storage.fetchChatContent(chaId, chatIndex, chatId)
}

export async function saveChatToServer(chaId: string, chatIndex: number, chatId: string, chat: Chat): Promise<void> {
    const storage = forageStorage.realStorage
    await storage.saveChatContent(chaId, chatIndex, chatId, chat)
}

// ── Hydration ───────────────────────────────────────────────────────────────

/**
 * Check if a specific chat is currently being hydrated (for dirty tracking suppression).
 */
export function isHydrating(chaId: string, chatId: string): boolean {
    const key = chatKey(chaId, chatId)
    return hydrationInFlight.has(key) || hydrationJustApplied.has(key)
}

/**
 * Hydrate a placeholder Chat in-place on the character's chats array.
 * If the slot is already a real Chat (not placeholder), returns it as-is.
 * Returns the hydrated Chat, or null if fetch failed.
 */
export async function ensureChatHydrated(
    chats: Chat[],
    index: number,
    chaId: string,
): Promise<Chat | null> {
    const slot = chats[index]
    if (!slot) return null
    if (!slot._placeholder) return slot

    const chatId = slot.id
    if (!chatId) return null
    const key = chatKey(chaId, chatId)

    // Deduplicate concurrent hydration for the same chat
    const existing = hydrationPromises.get(key)
    if (existing) return existing

    const promise = (async () => {
        hydrationInFlight.add(key)
        try {
            const full = await fetchChatFromServer(chaId, index, chatId)
            if (!full) {
                console.error(`[chatStorage] hydrate failed: chat not found on server (${key})`)
                return null
            }

            const currentIndex = chats.findIndex(chat => chat?.id === chatId)
            if (currentIndex === -1) {
                console.warn(`[chatStorage] hydrate skipped: chat removed before apply (${key})`)
                return null
            }

            const currentSlot = chats[currentIndex]
            if (!currentSlot?._placeholder) {
                return currentSlot
            }

            // Apply to memory — mark JustApplied to suppress the reactive write-back
            hydrationJustApplied.add(key)
            chats[currentIndex] = full

            // Wait one tick so Svelte reactivity settles before allowing dirty tracking
            await tick()
            hydrationJustApplied.delete(key)

            return full
        } finally {
            hydrationInFlight.delete(key)
            hydrationPromises.delete(key)
        }
    })()

    hydrationPromises.set(key, promise)
    return promise
}

/**
 * Convenience: ensure the current active chat for a character is hydrated.
 */
export async function ensureCurrentChatReady(
    chats: Chat[],
    chatPage: number,
    chaId: string,
): Promise<Chat | null> {
    return ensureChatHydrated(chats, chatPage, chaId)
}
