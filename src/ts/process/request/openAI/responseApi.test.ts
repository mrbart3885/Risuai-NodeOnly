import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    getDatabase: vi.fn(() => ({
        openAIKey: 'sk-test',
        modelTools: [],
        autofillRequestUrl: false,
        usePlainFetch: false,
    })),
    globalFetch: vi.fn(),
    fetchNative: vi.fn(),
    textifyReadableStream: vi.fn(async () => ''),
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
        mocks.fetchNative.mockReset()
        mocks.textifyReadableStream.mockResolvedValue('')
    })

    test('uses the selected model parameter set for responses API requests', async () => {
        const { requestOpenAIResponseAPI } = await import('./requests')

        await requestOpenAIResponseAPI({
            aiModel: 'gpt-5.5',
            formated: [{ role: 'user', content: 'hello' }],
            modelInfo: {
                id: 'copilot-gpt-5.5',
                internalID: 'gpt-5.5',
                parameters: ['temperature', 'top_p', 'reasoning_effort', 'verbosity'],
            },
            maxTokens: 256,
            mode: 'model',
            previewBody: true,
        } as any)

        expect(mocks.applyParameters).toHaveBeenCalledWith(
            expect.not.objectContaining({
                reasoning: expect.anything(),
            }),
            ['temperature', 'top_p', 'reasoning_effort', 'verbosity'],
            { reasoning_effort: 'reasoning.effort' },
            'model',
            { modelId: 'copilot-gpt-5.5' },
        )
    })

    test('prepends non-streaming reasoning summary output as thoughts', async () => {
        mocks.globalFetch.mockResolvedValue({
            ok: true,
            status: 200,
            data: {
                output: [
                    {
                        type: 'reasoning',
                        summary: [{ type: 'summary_text', text: 'summary text' }],
                    },
                    {
                        type: 'message',
                        content: [{ type: 'output_text', text: 'answer text' }],
                    },
                ],
            },
            headers: {},
        })
        const { requestOpenAIResponseAPI } = await import('./requests')

        const response = await requestOpenAIResponseAPI({
            aiModel: 'gpt-5.5',
            formated: [{ role: 'user', content: 'hello' }],
            modelInfo: {
                id: 'gpt-5.5',
                internalID: 'gpt-5.5',
                parameters: ['reasoning_effort', 'verbosity'],
            },
            maxTokens: 256,
            mode: 'model',
        } as any)

        expect(response).toEqual({
            type: 'success',
            result: '<Thoughts>\nsummary text\n</Thoughts>\nanswer text',
        })
    })

    test('streams responses API output text as cumulative chunks', async () => {
        const encoder = new TextEncoder()
        mocks.fetchNative.mockResolvedValue({
            status: 200,
            headers: new Headers({ 'Content-Type': 'text/event-stream' }),
            body: new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":"he"}\n\n'))
                    controller.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":"llo"}\n\n'))
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                    controller.close()
                },
            }),
        })
        const { requestOpenAIResponseAPI } = await import('./requests')

        const response = await requestOpenAIResponseAPI({
            aiModel: 'gpt-5.5',
            formated: [{ role: 'user', content: 'hello' }],
            modelInfo: {
                id: 'gpt-5.5',
                internalID: 'gpt-5.5',
                parameters: ['reasoning_effort', 'verbosity'],
            },
            maxTokens: 256,
            mode: 'model',
            useStreaming: true,
        } as any)

        expect(response.type).toBe('streaming')
        const reader = (response as any).result.getReader()
        const first = await reader.read()
        const second = await reader.read()

        expect(first.value).toEqual({ '0': 'he' })
        expect(second.value).toEqual({ '0': 'hello' })
    })

    test('streams responses API reasoning summary as thoughts', async () => {
        const encoder = new TextEncoder()
        mocks.fetchNative.mockResolvedValue({
            status: 200,
            headers: new Headers({ 'Content-Type': 'text/event-stream' }),
            body: new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode('data: {"type":"response.reasoning_summary_text.delta","delta":"why"}\n\n'))
                    controller.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":"answer"}\n\n'))
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                    controller.close()
                },
            }),
        })
        const { requestOpenAIResponseAPI } = await import('./requests')

        const response = await requestOpenAIResponseAPI({
            aiModel: 'gpt-5.5',
            formated: [{ role: 'user', content: 'hello' }],
            modelInfo: {
                id: 'gpt-5.5',
                internalID: 'gpt-5.5',
                parameters: ['reasoning_effort', 'verbosity'],
            },
            maxTokens: 256,
            mode: 'model',
            useStreaming: true,
        } as any)

        const reader = (response as any).result.getReader()
        const first = await reader.read()
        const second = await reader.read()

        expect(first.value).toEqual({ '0': '<Thoughts>\nwhy\n</Thoughts>\n' })
        expect(second.value).toEqual({ '0': '<Thoughts>\nwhy\n</Thoughts>\nanswer' })
    })
})
