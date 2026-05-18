import { describe, expect, test, vi } from 'vitest'

vi.mock('../../globalApi.svelte', () => ({
    AppendableBuffer: class {
        buffer = new Uint8Array(0)
        append() { }
    },
    saveAsset: vi.fn(),
}))

vi.mock('../../util', () => ({
    asBuffer: (arr: Uint8Array) => arr,
    Semaphore: class {
        constructor(_size: number) { }
        async acquire() { }
        release() { }
    },
    sleep: vi.fn(async () => { }),
}))

vi.mock('../../alert', () => ({
    alertStore: {
        set: vi.fn(),
    },
}))

vi.mock('../../parser/parser.svelte', () => ({
    hasher: vi.fn(async () => 'hash'),
}))

vi.mock('../../characterCards', () => ({
    hubURL: '/hub-proxy',
}))

import { retryWithBackoff } from '../processzip'

describe('retryWithBackoff', () => {
    test('succeeds on first attempt without retries', async () => {
        const operation = vi.fn().mockResolvedValue('ok')
        const sleepFn = vi.fn(async () => { })

        const result = await retryWithBackoff(operation, {
            maxAttempts: 3,
            baseDelayMs: 10,
            sleepFn,
        })

        expect(result).toBe('ok')
        expect(operation).toHaveBeenCalledTimes(1)
        expect(sleepFn).not.toHaveBeenCalled()
    })

    test('retries once on transient error and then succeeds', async () => {
        const operation = vi
            .fn()
            .mockRejectedValueOnce({ name: 'HttpError', status: 503, message: 'Service Unavailable' })
            .mockResolvedValueOnce('ok-after-retry')
        const sleepFn = vi.fn(async () => { })

        const result = await retryWithBackoff(operation, {
            maxAttempts: 3,
            baseDelayMs: 10,
            sleepFn,
        })

        expect(result).toBe('ok-after-retry')
        expect(operation).toHaveBeenCalledTimes(2)
        expect(sleepFn).toHaveBeenCalledTimes(1)
        expect(sleepFn).toHaveBeenNthCalledWith(1, 10)
    })

    test('throws after exhausting retries for transient errors', async () => {
        const error = { name: 'HttpError', status: 503, message: 'Service Unavailable' }
        const operation = vi.fn().mockRejectedValue(error)
        const sleepFn = vi.fn(async () => { })

        await expect(
            retryWithBackoff(operation, {
                maxAttempts: 3,
                baseDelayMs: 10,
                sleepFn,
            })
        ).rejects.toEqual(error)

        expect(operation).toHaveBeenCalledTimes(3)
        expect(sleepFn).toHaveBeenCalledTimes(2)
        expect(sleepFn).toHaveBeenNthCalledWith(1, 10)
        expect(sleepFn).toHaveBeenNthCalledWith(2, 20)
    })

    test('fails fast for non-transient errors', async () => {
        const error = new Error('bad request')
        const operation = vi.fn().mockRejectedValue(error)
        const sleepFn = vi.fn(async () => { })

        await expect(
            retryWithBackoff(operation, {
                maxAttempts: 3,
                baseDelayMs: 10,
                sleepFn,
            })
        ).rejects.toThrow('bad request')

        expect(operation).toHaveBeenCalledTimes(1)
        expect(sleepFn).not.toHaveBeenCalled()
    })

    test('retries on Cloudflare transient status code', async () => {
        const operation = vi
            .fn()
            .mockRejectedValueOnce({ name: 'HttpError', status: 522, message: 'Connection timed out' })
            .mockResolvedValueOnce('ok-after-cf-retry')
        const sleepFn = vi.fn(async () => { })

        const result = await retryWithBackoff(operation, {
            maxAttempts: 3,
            baseDelayMs: 10,
            sleepFn,
        })

        expect(result).toBe('ok-after-cf-retry')
        expect(operation).toHaveBeenCalledTimes(2)
        expect(sleepFn).toHaveBeenCalledTimes(1)
        expect(sleepFn).toHaveBeenNthCalledWith(1, 10)
    })
})
