import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    db: {
        reasoningEffort: -1,
        seperateParametersEnabled: false,
        OaiCompAPIKeys: {
            deepseek: 'ds-test',
        },
        modelTools: [],
        generationSeed: 0,
        jsonSchemaEnabled: false,
        OAIPrediction: '',
        newOAIHandle: false,
        openrouterFallback: false,
        openrouterMiddleOut: false,
        openrouterProvider: null,
        useInstructPrompt: false,
        reverseProxyOobaMode: false,
        localNetworkMode: false,
        genTime: 1,
    },
    globalFetch: vi.fn(),
    fetchNative: vi.fn(),
    textifyReadableStream: vi.fn(),
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
    getDatabase: () => mocks.db,
    getCurrentCharacter: vi.fn(() => null),
    getCurrentChat: vi.fn(() => []),
}))

vi.mock('src/ts/model/modellist', () => ({
    LLMFlags: {
        hasImageInput: 0,
        hasPrefill: 4,
        hasFullSystemPrompt: 6,
        hasFirstSystemPrompt: 7,
        hasStreaming: 8,
        OAICompletionTokens: 13,
        deepSeekPrefix: 17,
        deepSeekThinkingInput: 18,
        deepSeekThinkingOutput: 19,
    },
    LLMFormat: {
        OpenAICompatible: 0,
        Mistral: 4,
    },
}))

vi.mock('src/ts/model/openrouter', () => ({
    getFreeOpenRouterModels: vi.fn(),
}))

vi.mock('src/ts/globalApi.svelte', () => ({
    addFetchLog: vi.fn(),
    fetchNative: mocks.fetchNative,
    globalFetch: mocks.globalFetch,
    textifyReadableStream: mocks.textifyReadableStream,
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
    supportsInlayImage: vi.fn(() => false),
}))

vi.mock('../../mcp/mcp', () => ({
    callTool: vi.fn(),
    decodeToolCall: vi.fn(),
    encodeToolCall: vi.fn(),
}))

const requestArgs = {
    aiModel: 'deepseek-v4-pro',
    formated: [{ role: 'user', content: 'hello' }],
    modelInfo: {
        id: 'deepseek-v4-pro',
        internalID: 'deepseek-v4-pro',
        endpoint: 'https://api.deepseek.com/chat/completions',
        keyIdentifier: 'deepseek',
        flags: [],
        format: 0,
        parameters: ['reasoning_effort'],
    },
    maxTokens: 256,
    bias: {},
    biasString: [],
    mode: 'model',
    previewBody: true,
} as any

describe('DeepSeek V4 OpenAI-compatible request body', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.db.reasoningEffort = -1
        mocks.db.seperateParametersEnabled = false
    })

    test('disables thinking and omits reasoning_effort when effort is none', async () => {
        const { requestOpenAI } = await import('./requests')

        const response = await requestOpenAI(requestArgs)
        const preview = JSON.parse((response as any).result)

        expect(preview.url).toBe('https://api.deepseek.com/chat/completions')
        expect(preview.headers.Authorization).toBe('Bearer ds-test')
        expect(preview.body.thinking).toEqual({ type: 'disabled' })
        expect(preview.body.reasoning_effort).toBeUndefined()
    })

    test('maps xhigh effort to DeepSeek max reasoning effort', async () => {
        mocks.db.reasoningEffort = 3
        const { requestOpenAI } = await import('./requests')

        const response = await requestOpenAI(requestArgs)
        const preview = JSON.parse((response as any).result)

        expect(preview.body.thinking).toEqual({ type: 'enabled' })
        expect(preview.body.reasoning_effort).toBe('max')
    })
})
