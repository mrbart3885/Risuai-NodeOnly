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

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.dbState.simulationTarget = 'opencode'
    mocks.fetchNative.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
    })
})

describe('copilot OpenCode target (default)', () => {
    test('sends GitHub token directly as Bearer, no tid exchange', async () => {
        const { requestCopilot } = await import('./copilot')

        await requestCopilot({
            formated: [{ role: 'user', content: 'hello' }],
            modelInfo: { format: 'openai-compatible' },
        } as any)

        const tidCalls = mocks.fetchNative.mock.calls.filter(
            ([url]) => String(url).includes('/copilot_internal/v2/token')
        )
        expect(tidCalls).toHaveLength(0)

        expect(mocks.requestOpenAI).toHaveBeenCalledWith(
            expect.objectContaining({
                proxyPolicy: 'always',
                customURL: 'https://api.githubcopilot.com/chat/completions',
                key: 'ghp_test',
                extraHeaders: expect.objectContaining({
                    'Authorization': 'Bearer ghp_test',
                    'Openai-Intent': 'conversation-edits',
                    'X-Initiator': 'user',
                    'User-Agent': expect.stringContaining('opencode/'),
                    'x-session-affinity': expect.stringMatching(/^ses_[0-9a-f]{12}[0-9A-Za-z]{14}$/),
                }),
            }),
        )
    })

    test('routes Anthropic format to /v1/messages with beta headers', async () => {
        const { requestCopilot } = await import('./copilot')

        await requestCopilot({
            formated: [{ role: 'user', content: 'hi' }],
            modelInfo: { format: 'anthropic' },
        } as any)

        expect(mocks.requestClaude).toHaveBeenCalledWith(
            expect.objectContaining({
                customURL: 'https://api.githubcopilot.com/v1/messages',
                extraHeaders: expect.objectContaining({
                    'anthropic-version': '2023-06-01',
                    'anthropic-beta': 'effort-2025-11-24,interleaved-thinking-2025-05-14',
                }),
            }),
        )
    })

    test('adds Copilot-Vision-Request when image content present', async () => {
        const { requestCopilot } = await import('./copilot')

        await requestCopilot({
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

    test('validateCopilotToken probes OpenCode /models directly', async () => {
        const { validateCopilotToken } = await import('./copilot')

        const result = await validateCopilotToken('ghp_test')

        expect(result.valid).toBe(true)
        expect(mocks.fetchNative).toHaveBeenCalledWith(
            'https://api.githubcopilot.com/models',
            expect.objectContaining({
                proxyPolicy: 'always',
                headers: expect.objectContaining({
                    'Authorization': 'Bearer ghp_test',
                }),
            }),
        )
        const tidCalls = mocks.fetchNative.mock.calls.filter(
            ([url]) => String(url).includes('/copilot_internal/v2/token')
        )
        expect(tidCalls).toHaveLength(0)
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

    test('exchanges GitHub token → tid and sends VSCode headers', async () => {
        const { requestCopilot } = await import('./copilot')

        await requestCopilot({
            formated: [{ role: 'user', content: 'hello' }],
            modelInfo: { format: 'openai-compatible' },
        } as any)

        expect(mocks.fetchNative).toHaveBeenCalledWith(
            'https://api.github.com/copilot_internal/v2/token',
            expect.objectContaining({ proxyPolicy: 'always' }),
        )

        expect(mocks.requestOpenAI).toHaveBeenCalledWith(
            expect.objectContaining({
                proxyPolicy: 'always',
                customURL: 'https://api.individual.githubcopilot.com/chat/completions',
                key: 'tid-token',
                extraHeaders: expect.objectContaining({
                    'Authorization': 'Bearer tid-token',
                    'Copilot-Integration-Id': 'vscode-chat',
                    'Vscode-Machineid': 'stored-machine-id',
                    'Editor-Device-Id': 'stored-device-id',
                    'User-Agent': expect.stringContaining('GitHubCopilotChat/'),
                    'Editor-version': expect.stringContaining('vscode/'),
                }),
            }),
        )
    })

    test('validateCopilotToken exchanges tid then probes VSCode endpoint', async () => {
        const { validateCopilotToken } = await import('./copilot')

        const result = await validateCopilotToken('ghp_test')

        expect(result.valid).toBe(true)
        const urls = mocks.fetchNative.mock.calls.map(([u]) => String(u))
        expect(urls).toContain('https://api.github.com/copilot_internal/v2/token')
        expect(urls).toContain('https://api.individual.githubcopilot.com/models')
    })
})
