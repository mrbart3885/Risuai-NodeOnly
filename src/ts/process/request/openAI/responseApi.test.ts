import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    getDatabase: vi.fn(() => ({
        openAIKey: 'sk-test',
        modelTools: [],
        autofillRequestUrl: false,
        usePlainFetch: false,
    })),
    globalFetch: vi.fn(),
    applyParameters: vi.fn((data: Record<string, any>) => data),
}))

vi.mock('src/lang', () => ({
    language: {
        errors: {
            httpError: 'HTTP Error: ',
        },
    },
}))

vi.mock('src/ts/alert', () => ({
    alertError: vi.fn(),
}))

vi.mock('src/ts/storage/database.svelte', () => ({
    getDatabase: mocks.getDatabase,
    getCurrentCharacter: vi.fn(() => null),
    getCurrentChat: vi.fn(() => []),
}))

vi.mock('src/ts/model/modellist', () => ({
    LLMFlags: {},
    LLMFormat: {},
}))

vi.mock('src/ts/model/openrouter', () => ({
    getFreeOpenRouterModels: vi.fn(),
}))

vi.mock('src/ts/globalApi.svelte', () => ({
    addFetchLog: vi.fn(),
    fetchNative: vi.fn(),
    globalFetch: mocks.globalFetch,
    textifyReadableStream: vi.fn(),
}))

vi.mock('src/ts/network/localNetwork', () => ({
    isLocalNetworkUrl: vi.fn(() => false),
}))

vi.mock('../../templates/jsonSchema', () => ({
    extractJSON: vi.fn(),
    getOpenAIJSONSchema: vi.fn(),
}))

vi.mock('../../templates/chatTemplate', () => ({
    applyChatTemplate: vi.fn(),
}))

vi.mock('../../files/inlays', () => ({
    supportsInlayImage: vi.fn(),
}))

vi.mock('../../mcp/mcp', () => ({
    callTool: vi.fn(),
    decodeToolCall: vi.fn(),
    encodeToolCall: vi.fn(),
}))

vi.mock('../shared', () => ({
    applyParameters: mocks.applyParameters,
    setObjectValue: vi.fn((obj: Record<string, any>, key: string, value: any) => {
        obj[key] = value
        return obj
    }),
}))

describe('requestOpenAIResponseAPI', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.globalFetch.mockResolvedValue({
            ok: true,
            status: 200,
            data: {
                output: [
                    {
                        type: 'message',
                        content: [{ type: 'output_text', text: 'ok' }],
                    },
                ],
            },
            headers: {},
        })
    })

    test('uses the selected model parameter set for responses API requests', async () => {
        const { requestOpenAIResponseAPI } = await import('./requests')

        await requestOpenAIResponseAPI({
            aiModel: 'gpt-5.4',
            formated: [{ role: 'user', content: 'hello' }],
            modelInfo: {
                id: 'copilot-gpt-5.4',
                internalID: 'gpt-5.4',
                parameters: ['temperature', 'top_p', 'reasoning_effort', 'verbosity'],
            },
            maxTokens: 256,
            mode: 'model',
            previewBody: true,
        } as any)

        expect(mocks.applyParameters).toHaveBeenCalledWith(
            expect.any(Object),
            ['temperature', 'top_p', 'reasoning_effort', 'verbosity'],
            {},
            'model',
            { modelId: 'copilot-gpt-5.4' },
        )
    })
})
