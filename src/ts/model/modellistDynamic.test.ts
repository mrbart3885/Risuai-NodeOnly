import { beforeEach, describe, expect, test, vi } from 'vitest'
import { writable } from 'svelte/store'

const mocks = vi.hoisted(() => ({
    DBState: {
        db: {
            copilot: {
                githubTokens: [],
            },
            nanogpt: {
                apiKeys: ['ng-test-key'],
            },
            google: {
                accessToken: '',
            },
            ollamaCloudKey: 'oc-test-key',
        },
    },
    fetchNanoGPTModels: vi.fn(),
    fetchOllamaCloudModels: vi.fn(),
}))

vi.mock('../stores.svelte', () => ({
    DBState: mocks.DBState,
}))

vi.mock('../plugins/plugins.svelte', () => ({
    customProviderStore: writable([]),
    pluginV2: {},
}))

vi.mock('../plugins/apiV3/v3.svelte', () => ({
    customV3ProviderMetaStore: [],
}))

vi.mock('../storage/database.svelte', () => ({
    getDatabase: () => mocks.DBState.db,
}))

vi.mock('../globalApi.svelte', () => ({
    fetchNative: vi.fn(),
}))

vi.mock('../process/request/nanogpt', () => ({
    fetchNanoGPTModels: mocks.fetchNanoGPTModels,
}))

vi.mock('../process/request/ollamaCloud', () => ({
    fetchOllamaCloudModels: mocks.fetchOllamaCloudModels,
}))

describe('registerNanoGPTModelsDynamic', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('does not mark synced NanoGPT models as image-capable without vision metadata', async () => {
        mocks.fetchNanoGPTModels.mockResolvedValue({
            models: [
                {
                    id: 'custom/text-only-model',
                    name: 'Text Only Model',
                    ownedBy: 'Custom',
                },
            ],
        })

        const { LLMFlags, LLMModels, registerNanoGPTModelsDynamic } = await import('./modellist')

        for (let i = LLMModels.length - 1; i >= 0; i--) {
            if (LLMModels[i].id.startsWith('dynamic_nanogpt_')) {
                LLMModels.splice(i, 1)
            }
        }

        await registerNanoGPTModelsDynamic()

        const syncedModel = LLMModels.find((model) => model.id === 'dynamic_nanogpt_custom/text-only-model')

        expect(syncedModel).toBeDefined()
        expect(syncedModel?.flags.includes(LLMFlags.hasImageInput)).toBe(false)
    })

    test('registers Ollama Cloud models dynamically', async () => {
        mocks.fetchOllamaCloudModels.mockResolvedValue({
            models: [
                {
                    id: 'gpt-oss:120b',
                    name: 'gpt-oss:120b',
                    family: 'gpt-oss',
                    parameterSize: '120B',
                    quantizationLevel: '',
                    capabilities: ['completion'],
                },
            ],
        })

        const { LLMProvider, LLMModels, registerOllamaCloudModelsDynamic } = await import('./modellist')

        for (let i = LLMModels.length - 1; i >= 0; i--) {
            if (LLMModels[i].id.startsWith('dynamic_ollama_cloud_')) {
                LLMModels.splice(i, 1)
            }
        }

        await registerOllamaCloudModelsDynamic()

        const syncedModel = LLMModels.find((model) => model.id === 'dynamic_ollama_cloud_gpt-oss:120b')

        expect(syncedModel?.provider).toBe(LLMProvider.OllamaCloud)
        expect(syncedModel?.internalID).toBe('gpt-oss:120b')
    })

    test('surfaces Ollama Cloud model sync errors', async () => {
        mocks.fetchOllamaCloudModels.mockResolvedValue({
            models: [],
            error: 'Failed to fetch Ollama Cloud models (HTTP 401)',
        })

        const { registerOllamaCloudModelsDynamic } = await import('./modellist')

        await expect(registerOllamaCloudModelsDynamic()).rejects.toThrow('Failed to fetch Ollama Cloud models')
    })
})
