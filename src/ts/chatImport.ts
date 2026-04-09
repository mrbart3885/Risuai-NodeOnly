import { v4 } from 'uuid'
import type { Chat } from './storage/database.svelte'

function isNullish(data: unknown) {
    return data === undefined || data === null
}

function hasImportableChatShape(chat: Partial<Chat> | null | undefined): chat is Chat {
    return !!chat
        && !isNullish(chat.message)
        && !isNullish(chat.note)
        && !isNullish(chat.name)
        && !isNullish(chat.localLore)
}

export function normalizeImportedChat(chat: Partial<Chat> | null | undefined): Chat | null {
    if (!hasImportableChatShape(chat)) {
        return null
    }

    return {
        ...chat,
        message: chat.message,
        note: chat.note,
        name: chat.name,
        localLore: chat.localLore,
        id: v4(),
        fmIndex: chat.fmIndex ?? -1,
    }
}

export function extractChatFromHtmlExport(html: string): Chat | null {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const rawChat = doc.querySelector('.idat')?.textContent
    if (!rawChat) {
        return null
    }

    return normalizeImportedChat(JSON.parse(rawChat))
}
