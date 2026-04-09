import { describe, expect, test, vi } from 'vitest'

vi.mock('uuid', () => ({
    v4: () => 'new-chat-id',
}))

describe('chat import helpers', () => {
    test('HTML export에서 빈 note를 가진 채팅도 다시 가져올 수 있어야 한다', async () => {
        const { extractChatFromHtmlExport } = await import('./chatImport')
        const html = `
            <!DOCTYPE html>
            <html>
                <body>
                    <div class="idat">{"message":[{"role":"user","data":"hello"}],"note":"","name":"Imported Chat","localLore":[],"id":"old-chat-id"}</div>
                </body>
            </html>
        `

        const chat = extractChatFromHtmlExport(html)

        expect(chat).not.toBeNull()
        expect(chat?.note).toBe('')
        expect(chat?.name).toBe('Imported Chat')
    })

    test('가져온 채팅은 항상 새 chat.id를 받아야 한다', async () => {
        const { normalizeImportedChat } = await import('./chatImport')
        const chat = normalizeImportedChat({
            message: [{ role: 'user', data: 'hello' }],
            note: '',
            name: 'Imported Chat',
            localLore: [],
            id: 'old-chat-id',
        })

        expect(chat).not.toBeNull()
        expect(chat?.id).toBe('new-chat-id')
        expect(chat?.fmIndex).toBe(-1)
    })
})
