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
    fetchNative: vi.fn(),
    applyParameters: vi.fn((data: Record<string, any>) => data),
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
    fetchNative: mocks.fetchNative,
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
        OllamaCloud: 'ollama-cloud',
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
    applyParameters: mocks.applyParameters,
}))

vi.mock('ollama/dist/browser.mjs', () => ({
    Ollama: class {},
}))

describe('request provider routing', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getDatabase.mockReturnValue({
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
            top_p: 0.9,
            top_k: 40,
            repetition_penalty: 1.1,
            genTime: 1,
            extractJson: '',
            customProxyRequestModel: '',
            customAPIFormat: 0,
            forceReplaceUrl: '',
            proxyKey: '',
            openAIKey: '',
            modelTools: [],
            ollamaCloudKey: 'test-key',
            ollamaCloudModel: 'gpt-oss:120b',
            ollamaCloudThink: 'auto',
            ollamaCloudOptionsJson: '',
        } as any)
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

    test('routes Ollama Cloud models through the Ollama Cloud request endpoint', async () => {
        mocks.getModelInfo.mockReturnValue({
            id: 'dynamic_ollama_cloud_gpt-oss:120b',
            name: 'gpt-oss:120b',
            provider: 'ollama-cloud',
            format: 'ollama',
            flags: ['has-full-system-prompt'],
            parameters: ['temperature', 'top_p'],
            internalID: 'gpt-oss:120b',
            tokenizer: 0,
        })
        mocks.fetchNative.mockResolvedValue({
            ok: true,
            json: async () => ({ message: { content: 'ollama-cloud-ok' } }),
        })

        const { requestChatDataMain } = await import('./request')

        const result = await requestChatDataMain({
            formated: [{ role: 'user', content: 'hello' }],
            bias: {},
        } as any, 'model' as any)

        expect(mocks.fetchNative).toHaveBeenCalledWith('https://ollama.com/api/chat', expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
                Authorization: 'Bearer test-key',
                'Content-Type': 'application/json',
            }),
        }))
        expect(mocks.requestCopilot).not.toHaveBeenCalled()
        expect(mocks.requestNanoGPT).not.toHaveBeenCalled()
        expect(result).toEqual({ type: 'success', result: 'ollama-cloud-ok' })
    })
})

describe('Ollama Cloud request helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getDatabase.mockReturnValue({
            ollamaCloudKey: 'test-key',
            ollamaCloudModel: 'gpt-oss:120b',
            ollamaCloudThink: 'auto',
            ollamaCloudOptionsJson: '',
            temperature: 80,
            top_p: 0.9,
            top_k: 40,
            repetition_penalty: 1.1,
            seperateParametersEnabled: false,
        } as any)
    })

    test('resolveOllamaThinkMode omits automatic think mode', async () => {
        const { resolveOllamaThinkMode } = await import('./ollamaCloud')

        expect(resolveOllamaThinkMode('auto')).toBeUndefined()
    })

    test('resolveOllamaThinkMode maps on to true', async () => {
        const { resolveOllamaThinkMode } = await import('./ollamaCloud')

        expect(resolveOllamaThinkMode('on')).toBe(true)
    })

    test('resolveOllamaThinkMode preserves high effort', async () => {
        const { resolveOllamaThinkMode } = await import('./ollamaCloud')

        expect(resolveOllamaThinkMode('high')).toBe('high')
    })

    test('parseOllamaCloudOptionsJson rejects invalid JSON', async () => {
        const { parseOllamaCloudOptionsJson } = await import('./ollamaCloud')

        expect(parseOllamaCloudOptionsJson('{bad json')).toEqual({
            ok: false,
            error: 'Ollama Cloud options JSON is invalid.',
        })
    })

    test('custom Ollama Cloud entry uses the selected cloud model instead of the provider entry id', async () => {
        const { buildOllamaCloudChatBody } = await import('./ollamaCloud')

        const body = buildOllamaCloudChatBody({
            formated: [{ role: 'user', content: 'hello' }],
            bias: {},
            useStreaming: false,
            modelInfo: {
                id: 'ollama-cloud',
                internalID: 'ollama-cloud',
                provider: 'ollama-cloud',
                format: 'ollama',
                flags: [],
                parameters: ['temperature'],
                tokenizer: 0,
                name: 'Ollama Cloud',
            },
        } as any, {})

        expect(body.model).toBe('gpt-oss:120b')
    })

    test('invalid Ollama Cloud options JSON fails before making a request', async () => {
        mocks.getDatabase.mockReturnValue({
            ollamaCloudKey: 'test-key',
            ollamaCloudModel: 'gpt-oss:120b',
            ollamaCloudThink: 'auto',
            ollamaCloudOptionsJson: '{bad json',
            temperature: 80,
            top_p: 0.9,
            top_k: 40,
            repetition_penalty: 1.1,
            seperateParametersEnabled: false,
        } as any)
        const { requestOllamaCloud } = await import('./ollamaCloud')

        const result = await requestOllamaCloud({
            formated: [{ role: 'user', content: 'hello' }],
            bias: {},
            modelInfo: {
                id: 'ollama-cloud',
                provider: 'ollama-cloud',
                format: 'ollama',
                flags: [],
                parameters: ['temperature'],
                tokenizer: 0,
                name: 'Ollama Cloud',
            },
        } as any)

        expect(mocks.fetchNative).not.toHaveBeenCalled()
        expect(result).toEqual({
            type: 'fail',
            result: 'Ollama Cloud options JSON is invalid.',
            noRetry: true,
        })
    })

    test('streaming Ollama Cloud responses preserve thinking separately from content', async () => {
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(encoder.encode('{"message":{"thinking":"A"},"done":false}\n'))
                controller.enqueue(encoder.encode('{"message":{"thinking":"B"},"done":false}\n'))
                controller.enqueue(encoder.encode('{"message":{"content":"ok"},"done":true}\n'))
                controller.close()
            },
        })
        mocks.fetchNative.mockResolvedValue(new Response(stream, { status: 200 }))

        const { requestOllamaCloud } = await import('./ollamaCloud')
        const result = await requestOllamaCloud({
            formated: [{ role: 'user', content: 'hello' }],
            bias: {},
            useStreaming: true,
            modelInfo: {
                id: 'ollama-cloud',
                provider: 'ollama-cloud',
                format: 'ollama',
                flags: [],
                parameters: ['temperature'],
                tokenizer: 0,
                name: 'Ollama Cloud',
            },
        } as any)

        expect(result.type).toBe('streaming')
        if (result.type !== 'streaming') return

        const reader = result.result.getReader()
        const chunks: string[] = []
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(value['0'] ?? '')
        }

        expect(chunks).toEqual([
            '<Thoughts>\nA',
            '<Thoughts>\nAB',
            '<Thoughts>\nAB\n</Thoughts>\n\nok',
        ])
    })
})
