import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    fetchNative: vi.fn(),
    getDatabase: vi.fn(() => ({
        nanogpt: {
            apiKeys: ['ng-test-key'],
            keyRotate: 'sequential',
        },
    })),
    requestOpenAI: vi.fn(),
}))

vi.mock('../../globalApi.svelte', () => ({
    fetchNative: mocks.fetchNative,
}))

vi.mock('../../storage/database.svelte', () => ({
    getDatabase: mocks.getDatabase,
}))

vi.mock('./openAI/requests', () => ({
    requestOpenAI: mocks.requestOpenAI,
}))

describe('NanoGPT usage parsing', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('maps weekly token and daily image usage from the live subscription payload', async () => {
        mocks.fetchNative.mockResolvedValue(new Response(JSON.stringify({
            active: true,
            provider: 'stripe',
            providerStatus: 'active',
            providerStatusRaw: 'active',
            stripeSubscriptionId: 'sub_1TIrVqD3YkwXiHh35txwwOJh',
            cancellationReason: null,
            canceledAt: null,
            endedAt: null,
            cancelAt: '2026-05-05T14:18:50.000Z',
            cancelAtPeriodEnd: false,
            limits: {
                weeklyInputTokens: 60000000,
                dailyInputTokens: null,
                dailyImages: 100,
            },
            allowOverage: false,
            period: {
                currentPeriodEnd: '2026-05-05T14:18:50.000Z',
            },
            dailyImages: {
                used: 0,
                remaining: 100,
                percentUsed: 0,
                resetAt: 1775520000000,
            },
            dailyInputTokens: null,
            weeklyInputTokens: {
                used: 0,
                remaining: 60000000,
                percentUsed: 0,
                resetAt: 1776038400000,
            },
            state: 'active',
            graceUntil: null,
        }), {
            status: 200,
            headers: {
                'content-type': 'application/json',
            },
        }))

        const { fetchNanoGPTUsage } = await import('./nanogpt')
        const result = await fetchNanoGPTUsage('ng-test-key')

        expect(mocks.fetchNative).toHaveBeenCalledWith(
            'https://nano-gpt.com/api/subscription/v1/usage',
            expect.objectContaining({
                method: 'GET',
                headers: expect.objectContaining({
                    Authorization: 'Bearer ng-test-key',
                    Accept: 'application/json',
                }),
            })
        )

        expect(result.error).toBeUndefined()
        expect(result.usage).toMatchObject({
            active: true,
            state: 'active',
            provider: 'stripe',
            providerStatus: 'active',
            providerStatusRaw: 'active',
            cancelAt: '2026-05-05T14:18:50.000Z',
            cancelAtPeriodEnd: false,
            allowOverage: false,
            periodEnd: '2026-05-05T14:18:50.000Z',
            weeklyInputTokens: {
                limit: 60000000,
                used: 0,
                remaining: 60000000,
                percentUsed: 0,
                progress: 0,
                resetAt: 1776038400000,
            },
            dailyImages: {
                limit: 100,
                used: 0,
                remaining: 100,
                percentUsed: 0,
                progress: 0,
                resetAt: 1775520000000,
            },
        })
        expect(result.usage?.dailyInputTokens).toBeNull()
    })

    test('sends an explicit JSON body when requesting NanoGPT balance', async () => {
        mocks.fetchNative.mockResolvedValue(new Response(JSON.stringify({
            usd_balance: '12.34',
            nano_balance: '56.78',
        }), {
            status: 200,
            headers: {
                'content-type': 'application/json',
            },
        }))

        const { fetchNanoGPTBalance } = await import('./nanogpt')
        const result = await fetchNanoGPTBalance('ng-test-key')

        expect(mocks.fetchNative).toHaveBeenCalledWith(
            'https://nano-gpt.com/api/check-balance',
            expect.objectContaining({
                method: 'POST',
                body: '{}',
                headers: expect.objectContaining({
                    'x-api-key': 'ng-test-key',
                    'Content-Type': 'application/json',
                }),
            })
        )

        expect(result).toEqual({
            balance: {
                usdBalance: '12.34',
                nanoBalance: '56.78',
            },
        })
    })
})
