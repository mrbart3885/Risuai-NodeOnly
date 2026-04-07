import { describe, expect, test, vi } from 'vitest'
import {
    consumeSaveRequestOptions,
    mergeSaveRequestOptions,
    requestSaveBestEffort,
    requestSaveInBackground,
    type SaveRequestOptions,
} from './saveRequestQueue'

describe('saveRequestQueue', () => {
    test('upgrades queued requests to a forced full write', () => {
        const queued = mergeSaveRequestOptions(null, {
            skipBroadcast: true,
            skipBackups: true,
        })

        const merged = mergeSaveRequestOptions(queued, {
            forceFullWrite: true,
            skipBackups: true,
        })

        expect(merged).toEqual({
            forceFullWrite: true,
            skipBroadcast: false,
            skipBackups: true,
        })
    })

    test('consumes pending options into the next save attempt', () => {
        const pending: SaveRequestOptions = {
            forceFullWrite: true,
            skipBackups: true,
        }

        const { effective, pending: remaining } = consumeSaveRequestOptions(pending)

        expect(effective).toEqual({
            forceFullWrite: true,
            skipBackups: true,
        })
        expect(remaining).toBeNull()
    })

    test('best-effort save swallows async save failures after reporting them', async () => {
        const error = new Error('save failed')
        const onError = vi.fn()

        await expect(
            requestSaveBestEffort(() => Promise.reject(error), {
                forceFullWrite: true,
            }, onError)
        ).resolves.toBeUndefined()

        expect(onError).toHaveBeenCalledWith(error)
    })

    test('background save reports async failures without rethrowing them', async () => {
        const error = new Error('background save failed')
        const onError = vi.fn()

        expect(() => requestSaveInBackground(() => Promise.reject(error), {
            skipBackups: true,
        }, onError)).not.toThrow()

        await Promise.resolve()

        expect(onError).toHaveBeenCalledWith(error)
    })
})
