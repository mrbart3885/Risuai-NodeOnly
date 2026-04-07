import { describe, expect, test } from 'vitest'
import { consumeSaveRequestOptions, mergeSaveRequestOptions, type SaveRequestOptions } from './saveRequestQueue'

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
})
