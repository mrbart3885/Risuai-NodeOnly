import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    getDatabase: vi.fn(() => ({
        aiModel: 'test-model',
        subModel: 'test-model',
        seperateModelsForAxModels: false,
        seperateModels: {},
        maxResponse: 512,
        useStreaming: false,
        requestRetrys: 0,
        antiServerOverloads: false,
        fallbackWhenBlankResponse: false,
        systemContentReplacement: '',
        systemRoleReplacement: 'system',
        customModels: [],
        temperature: 80,
        genTime: 1,
        extractJson: '',
        customProxyRequestModel: '',
        customAPIFormat: 0,
        forceReplaceUrl: '',
        proxyKey: '',
        openAIKey: '',
        modelTools: [],
    })),
    getModelInfo: vi.fn(() => ({
        id: 'test-model',
        provider: 'openai',
        format: 'openai-compatible',
        flags: [],
        parameters: ['temperature', 'top_p'],
        internalID: 'test-model',
        tokenizer: 0,
        name: 'Test Model',
    })),
    requestCopilot: vi.fn(async () => ({ type: 'success', result: 'copilot-ok' })),
    requestNanoGPT: vi.fn(async () => ({ type: 'success', result: 'nanogpt-ok' })),
}))

vi.mock('../../../lang', () => ({
    language: {
        errors: {
            unknownModel: 'Unknown model',
        },
    },
}))

vi.mock('../../globalApi.svelte', () => ({
    globalFetch: vi.fn(),
}))

vi.mock('../../model/modellist', () => ({
    getModelInfo: mocks.getModelInfo,
    LLMFlags: {
        hasFullSystemPrompt: 'has-full-system-prompt',
        hasFirstSystemPrompt: 'has-first-system-prompt',
        requiresAlternateRole: 'requires-alternate-role',
        mustStartWithUserInput: 'must-start-with-user-input',
    },
    LLMFormat: {
        OpenAICompatible: 'openai-compatible',
        Mistral: 'mistral',
        OpenAILegacyInstruct: 'legacy',
        NovelAI: 'novel',
        OobaLegacy: 'ooba-legacy',
        Plugin: 'plugin',
        Ooba: 'ooba',
        VertexAIGemini: 'vertex',
        GoogleCloud: 'google',
        Kobold: 'kobold',
        NovelList: 'novel-list',
        Ollama: 'ollama',
        Cohere: 'cohere',
        Anthropic: 'anthropic',
        AnthropicLegacy: 'anthropic-legacy',
        AWSBedrockClaude: 'bedrock-claude',
        Horde: 'horde',
        WebLLM: 'webllm',
        OpenAIResponseAPI: 'responses',
        Echo: 'echo',
    },
    LLMProvider: {
        Copilot: 'copilot',
        NanoGPT: 'nanogpt',
    },
}))

vi.mock('../../parser/parser.svelte', () => ({
    risuChatParser: vi.fn(),
    risuEscape: vi.fn((value: string) => value),
    risuUnescape: vi.fn((value: string) => value),
}))

vi.mock('../../plugins/plugins.svelte', () => ({
    pluginProcess: vi.fn(),
    pluginV2: {
        replacerbeforeRequest: new Set(),
        replacerafterRequest: new Set(),
    },
}))

vi.mock('../../storage/database.svelte', () => ({
    getCurrentCharacter: vi.fn(() => null),
    getCurrentChat: vi.fn(() => []),
    getDatabase: mocks.getDatabase,
}))

vi.mock('../../tokenizer', () => ({
    tokenizeNum: vi.fn(),
}))

vi.mock('../../util', () => ({
    sleep: vi.fn(async () => undefined),
}))

vi.mock('../mcp/mcp', () => ({
    getTools: vi.fn(async () => []),
}))

vi.mock('../models/nai', () => ({
    NovelAIBadWordIds: [],
    stringlizeNAIChat: vi.fn(),
}))

vi.mock('../prompt', () => ({
    OobaParams: {},
}))

vi.mock('../stringlize', () => ({
    getStopStrings: vi.fn(() => []),
    stringlizeAINChat: vi.fn(),
    unstringlizeAIN: vi.fn(),
    unstringlizeChat: vi.fn(),
}))

vi.mock('../templates/chatTemplate', () => ({
    applyChatTemplate: vi.fn(),
}))

vi.mock('../transformers', () => ({
    runTransformers: vi.fn(),
}))

vi.mock('../triggers', () => ({
    runTrigger: vi.fn(async () => ({ displayData: '[]' })),
}))

vi.mock('./anthropic', () => ({
    requestClaude: vi.fn(),
}))

vi.mock('./copilot', () => ({
    requestCopilot: mocks.requestCopilot,
}))

vi.mock('./nanogpt', () => ({
    requestNanoGPT: mocks.requestNanoGPT,
}))

vi.mock('./google', () => ({
    requestGoogleCloudVertex: vi.fn(),
}))

vi.mock('./openAI/requests', () => ({
    requestOpenAI: vi.fn(),
    requestOpenAILegacyInstruct: vi.fn(),
    requestOpenAIResponseAPI: vi.fn(),
}))

vi.mock('./shared', () => ({
    applyParameters: vi.fn(),
}))

vi.mock('ollama/dist/browser.mjs', () => ({
    Ollama: class {},
}))

describe('request provider routing', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('routes Copilot models through requestCopilot', async () => {
        mocks.getModelInfo.mockReturnValue({
            id: 'copilot-gpt-5.4',
            name: 'GitHub Copilot GPT-5.4',
            provider: 'copilot',
            format: 'responses',
            flags: [],
            parameters: ['temperature', 'top_p'],
            internalID: 'gpt-5.4',
            tokenizer: 0,
        })

        const { requestChatDataMain } = await import('./request')

        const result = await requestChatDataMain({
            formated: [{ role: 'user', content: 'hello' }],
            bias: {},
        } as any, 'model' as any)

        expect(mocks.requestCopilot).toHaveBeenCalledTimes(1)
        expect(mocks.requestNanoGPT).not.toHaveBeenCalled()
        expect(result).toEqual({ type: 'success', result: 'copilot-ok' })
    })

    test('routes NanoGPT models through requestNanoGPT', async () => {
        mocks.getModelInfo.mockReturnValue({
            id: 'nanogpt-openai/gpt-5.4',
            name: 'NanoGPT GPT-5.4',
            provider: 'nanogpt',
            format: 'openai-compatible',
            flags: [],
            parameters: ['temperature', 'top_p'],
            internalID: 'openai/gpt-5.4',
            tokenizer: 0,
        })

        const { requestChatDataMain } = await import('./request')

        const result = await requestChatDataMain({
            formated: [{ role: 'user', content: 'hello' }],
            bias: {},
        } as any, 'model' as any)

        expect(mocks.requestNanoGPT).toHaveBeenCalledTimes(1)
        expect(mocks.requestCopilot).not.toHaveBeenCalled()
        expect(result).toEqual({ type: 'success', result: 'nanogpt-ok' })
    })
})
