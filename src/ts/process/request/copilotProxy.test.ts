import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    fetchNative: vi.fn(),
    requestOpenAI: vi.fn(async () => ({ type: 'success', result: 'ok' })),
    requestOpenAIResponseAPI: vi.fn(async () => ({ type: 'success', result: 'ok' })),
    requestClaude: vi.fn(async () => ({ type: 'success', result: 'ok' })),
    dbState: {
        simulationTarget: 'opencode' as 'opencode' | 'vscode',
        machineId: 'stored-machine-id',
        deviceId: 'stored-device-id',
        thinkingType: 'adaptive' as string,
    },
    getDatabase: vi.fn(),
}))

mocks.getDatabase.mockImplementation(() => ({
    copilot: {
        githubTokens: ['ghp_test'],
        keyRotate: 'sequential',
        simulationTarget: mocks.dbState.simulationTarget,
        machineId: mocks.dbState.machineId,
        deviceId: mocks.dbState.deviceId,
        vsCodeVersion: '',
        chatVersion: '',
    },
    thinkingType: mocks.dbState.thinkingType,
    OaiCompAPIKeys: {},
}))

vi.mock('src/ts/globalApi.svelte', () => ({
    fetchNative: mocks.fetchNative,
}))

vi.mock('src/ts/storage/database.svelte', () => ({
    getDatabase: mocks.getDatabase,
}))

vi.mock('src/ts/model/modellist', () => ({
    LLMFormat: {
        Anthropic: 'anthropic',
        OpenAIResponseAPI: 'responses',
        OpenAICompatible: 'openai-compatible',
    },
}))

vi.mock('src/ts/model/types', () => ({
    LLMFlags: {
        claudeAdaptiveThinking: 22,
    },
}))

vi.mock('./openAI/requests', () => ({
    requestOpenAI: mocks.requestOpenAI,
    requestOpenAIResponseAPI: mocks.requestOpenAIResponseAPI,
}))

vi.mock('./anthropic', () => ({
    requestClaude: mocks.requestClaude,
}))

vi.mock('uuid', () => ({
    v4: () => 'uuid-fixed',
}))

const SES_REGEX = /^ses_[0-9a-f]{12}[0-9A-Za-z]{14}$/

const firstArg = (fn: any): any => (fn.mock.calls[0] as any[])[0]
const callArgAt = (fn: any, idx: number): any => (fn.mock.calls[idx] as any[])[0]

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.dbState.simulationTarget = 'opencode'
    mocks.dbState.thinkingType = 'adaptive'
    mocks.fetchNative.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
    })
})

describe('copilot OpenCode target (default)', () => {
    test('user chat: direct Bearer + x-initiator: user + stable per-chat session', async () => {
        const { requestCopilot } = await import('./copilot')

        await requestCopilot({
            chatId: 'chat-A',
            formated: [{ role: 'user', content: 'hello' }],
            modelInfo: { format: 'openai-compatible' },
        } as any)

        // No tid exchange
        const tidCalls = mocks.fetchNative.mock.calls.filter(
            ([url]) => String(url).includes('/copilot_internal/v2/token')
        )
        expect(tidCalls).toHaveLength(0)

        const call = firstArg(mocks.requestOpenAI)
        const headers = call.extraHeaders

        expect(call).toMatchObject({
            proxyPolicy: 'always',
            customURL: 'https://api.githubcopilot.com/chat/completions',
            key: 'ghp_test',
        })
        expect(headers).toMatchObject({
            'Authorization': 'Bearer ghp_test',
            'Openai-Intent': 'conversation-edits',
            'x-initiator': 'user',
            'User-Agent': expect.stringContaining('opencode/'),
        })
        expect(headers['x-session-affinity']).toMatch(SES_REGEX)
        expect(headers['x-parent-session-id']).toBeUndefined()

        // Second call on same chat reuses the session
        mocks.requestOpenAI.mockClear()
        await requestCopilot({
            chatId: 'chat-A',
            formated: [{ role: 'user', content: 'hi again' }],
            modelInfo: { format: 'openai-compatible' },
        } as any)
        const secondHeaders = firstArg(mocks.requestOpenAI).extraHeaders
        expect(secondHeaders['x-session-affinity']).toBe(headers['x-session-affinity'])
    })

    test('separate chats get separate sessions', async () => {
        const { requestCopilot } = await import('./copilot')

        await requestCopilot({
            chatId: 'chat-A',
            formated: [{ role: 'user', content: 'hi A' }],
            modelInfo: { format: 'openai-compatible' },
        } as any)
        const sessionA = firstArg(mocks.requestOpenAI).extraHeaders['x-session-affinity']

        mocks.requestOpenAI.mockClear()
        await requestCopilot({
            chatId: 'chat-B',
            formated: [{ role: 'user', content: 'hi B' }],
            modelInfo: { format: 'openai-compatible' },
        } as any)
        const sessionB = firstArg(mocks.requestOpenAI).extraHeaders['x-session-affinity']

        expect(sessionA).toMatch(SES_REGEX)
        expect(sessionB).toMatch(SES_REGEX)
        expect(sessionA).not.toBe(sessionB)
    })

    test('agent mode (translate/memory/emotion): x-initiator: agent + x-parent-session-id points to chat', async () => {
        const { requestCopilot } = await import('./copilot')

        // Prime the chat session first with a user turn
        await requestCopilot({
            chatId: 'chat-A',
            formated: [{ role: 'user', content: 'hi' }],
            modelInfo: { format: 'openai-compatible' },
        } as any)
        const chatSession = firstArg(mocks.requestOpenAI).extraHeaders['x-session-affinity']

        mocks.requestOpenAI.mockClear()
        await requestCopilot({
            chatId: 'chat-A',
            mode: 'translate',
            formated: [{ role: 'user', content: 'translate me' }],
            modelInfo: { format: 'openai-compatible' },
        } as any)
        const headers = firstArg(mocks.requestOpenAI).extraHeaders

        expect(headers['x-initiator']).toBe('agent')
        expect(headers['x-parent-session-id']).toBe(chatSession)
        expect(headers['x-session-affinity']).toMatch(SES_REGEX)
        expect(headers['x-session-affinity']).not.toBe(chatSession)
    })

    test('tool-use follow-up: last message role=tool triggers x-initiator: agent', async () => {
        const { requestCopilot } = await import('./copilot')

        await requestCopilot({
            chatId: 'chat-A',
            formated: [
                { role: 'user', content: 'do something' },
                { role: 'assistant', content: 'ok', tool_calls: [] },
                { role: 'tool', content: 'tool result' },
            ],
            modelInfo: { format: 'openai-compatible' },
        } as any)

        const headers = firstArg(mocks.requestOpenAI).extraHeaders
        expect(headers['x-initiator']).toBe('agent')
        expect(headers['x-parent-session-id']).toMatch(SES_REGEX)
    })

    test('anthropic: effort-2025-11-24 included when model has claudeAdaptiveThinking', async () => {
        const { requestCopilot } = await import('./copilot')

        await requestCopilot({
            chatId: 'chat-A',
            formated: [{ role: 'user', content: 'hi' }],
            modelInfo: { format: 'anthropic', flags: [22 /* claudeAdaptiveThinking */] },
        } as any)

        const headers = firstArg(mocks.requestClaude).extraHeaders
        expect(headers).toMatchObject({
            'anthropic-version': '2023-06-01',
            'anthropic-beta': 'effort-2025-11-24,interleaved-thinking-2025-05-14',
        })
    })

    test('anthropic: interleaved-only when model lacks adaptive thinking', async () => {
        const { requestCopilot } = await import('./copilot')

        await requestCopilot({
            chatId: 'chat-A',
            formated: [{ role: 'user', content: 'hi' }],
            modelInfo: { format: 'anthropic', flags: [] },
        } as any)

        const headers = firstArg(mocks.requestClaude).extraHeaders
        expect(headers['anthropic-beta']).toBe('interleaved-thinking-2025-05-14')
    })

    test('anthropic: interleaved-only when db.thinkingType is off', async () => {
        mocks.dbState.thinkingType = 'off'
        const { requestCopilot } = await import('./copilot')

        await requestCopilot({
            chatId: 'chat-A',
            formated: [{ role: 'user', content: 'hi' }],
            modelInfo: { format: 'anthropic', flags: [22] },
        } as any)

        const headers = firstArg(mocks.requestClaude).extraHeaders
        expect(headers['anthropic-beta']).toBe('interleaved-thinking-2025-05-14')
    })

    test('image attachment adds Copilot-Vision-Request', async () => {
        const { requestCopilot } = await import('./copilot')

        await requestCopilot({
            chatId: 'chat-A',
            formated: [{
                role: 'user',
                content: [
                    { type: 'text', text: 'describe' },
                    { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } },
                ],
            }],
            modelInfo: { format: 'openai-compatible' },
        } as any)

        expect(mocks.requestOpenAI).toHaveBeenCalledWith(
            expect.objectContaining({
                extraHeaders: expect.objectContaining({
                    'Copilot-Vision-Request': 'true',
                }),
            }),
        )
    })

    test('/models probe: minimal headers (Authorization, User-Agent, Accept only)', async () => {
        const { validateCopilotToken } = await import('./copilot')

        await validateCopilotToken('ghp_test')

        const call = mocks.fetchNative.mock.calls.find(
            ([url]) => String(url).endsWith('/models')
        )
        expect(call).toBeDefined()
        const probeHeaders = call![1].headers as Record<string, string>
        expect(Object.keys(probeHeaders).sort()).toEqual(['Accept', 'Authorization', 'User-Agent'])
        expect(probeHeaders['Accept']).toBe('*/*')
        expect(probeHeaders['User-Agent']).toMatch(/^opencode\/[\d.]+$/)
    })
})

describe('copilot VSCode target (opt-in)', () => {
    beforeEach(() => {
        mocks.dbState.simulationTarget = 'vscode'
        mocks.fetchNative.mockImplementation(async (url: string) => {
            if (url.includes('/copilot_internal/v2/token')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        token: 'tid-token',
                        expires_at: Math.floor(Date.now() / 1000) + 3600,
                    }),
                }
            }
            return { ok: true, status: 200, json: async () => ({ data: [] }) }
        })
    })

    test('exchanges tid + VSCode headers + honors x-initiator', async () => {
        const { requestCopilot } = await import('./copilot')

        await requestCopilot({
            chatId: 'chat-A',
            formated: [{ role: 'user', content: 'hello' }],
            modelInfo: { format: 'openai-compatible' },
        } as any)

        expect(mocks.fetchNative).toHaveBeenCalledWith(
            'https://api.github.com/copilot_internal/v2/token',
            expect.objectContaining({ proxyPolicy: 'always' }),
        )

        const call = firstArg(mocks.requestOpenAI)
        expect(call).toMatchObject({
            proxyPolicy: 'always',
            customURL: 'https://api.individual.githubcopilot.com/chat/completions',
            key: 'tid-token',
        })
        expect(call.extraHeaders).toMatchObject({
            'Authorization': 'Bearer tid-token',
            'Copilot-Integration-Id': 'vscode-chat',
            'Vscode-Machineid': 'stored-machine-id',
            'Editor-Device-Id': 'stored-device-id',
            'X-Initiator': 'user',
        })
    })

    test('agent mode also propagates on VSCode', async () => {
        const { requestCopilot } = await import('./copilot')

        await requestCopilot({
            chatId: 'chat-A',
            mode: 'emotion',
            formated: [{ role: 'user', content: 'tag' }],
            modelInfo: { format: 'openai-compatible' },
        } as any)

        const headers = firstArg(mocks.requestOpenAI).extraHeaders
        expect(headers['X-Initiator']).toBe('agent')
        expect(headers['x-parent-session-id']).toBeDefined()
    })
})
