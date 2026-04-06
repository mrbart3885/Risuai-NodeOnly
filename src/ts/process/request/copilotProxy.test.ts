import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    fetchNative: vi.fn(),
    requestOpenAI: vi.fn(async () => ({ type: 'success', result: 'ok' })),
    requestOpenAIResponseAPI: vi.fn(async () => ({ type: 'success', result: 'ok' })),
    requestClaude: vi.fn(async () => ({ type: 'success', result: 'ok' })),
    getDatabase: vi.fn(() => ({
        copilot: {
            githubTokens: ['ghp_test'],
            keyRotate: 'sequential',
            machineId: 'machine-id',
            vsCodeVersion: '1.111.0',
            chatVersion: '0.39.2',
        },
        OaiCompAPIKeys: {},
    })),
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

describe('copilot proxy policy', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.clearAllMocks()
        mocks.fetchNative.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                token: 'tid-token',
                expires_at: Math.floor(Date.now() / 1000) + 3600,
            }),
        })
    })

    test('forces proxy for token exchange and downstream chat request', async () => {
        const { requestCopilot } = await import('./copilot')

        await requestCopilot({
            formated: [{ role: 'user', content: 'hello' }],
            modelInfo: { format: 'openai-compatible' },
        } as any)

        expect(mocks.fetchNative).toHaveBeenCalledWith(
            'https://api.github.com/copilot_internal/v2/token',
            expect.objectContaining({
                method: 'GET',
                proxyPolicy: 'always',
            }),
        )

        expect(mocks.requestOpenAI).toHaveBeenCalledWith(
            expect.objectContaining({
                proxyPolicy: 'always',
            }),
        )
    })

    test('forces proxy for model and usage lookups', async () => {
        mocks.fetchNative
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    token: 'tid-token',
                    expires_at: Math.floor(Date.now() / 1000) + 3600,
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ data: [] }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    login: 'test',
                    copilot_plan: 'monthly',
                    quota_reset_date: '2026-05-01',
                    quota_snapshots: {},
                }),
            })

        const { fetchCopilotModels, fetchCopilotUsage } = await import('./copilot')

        await fetchCopilotModels('ghp_test')
        await fetchCopilotUsage('ghp_test')

        expect(mocks.fetchNative).toHaveBeenNthCalledWith(
            2,
            'https://api.individual.githubcopilot.com/models',
            expect.objectContaining({
                method: 'GET',
                proxyPolicy: 'always',
            }),
        )
        expect(mocks.fetchNative).toHaveBeenNthCalledWith(
            3,
            'https://api.github.com/copilot_internal/user',
            expect.objectContaining({
                method: 'GET',
                proxyPolicy: 'always',
            }),
        )
    })

})
