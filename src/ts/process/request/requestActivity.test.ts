import { get } from 'svelte/store'
import { beforeEach, describe, expect, test } from 'vitest'
import {
    createRequestActivityState,
    endRequestActivity,
    getRequestActivityLabel,
    isTrackedRequestActivityMode,
    requestActivityStore,
    resetRequestActivityStore,
    startRequestActivity,
    trackedRequestActivityModes,
    withTrackedRequestActivity,
} from './requestActivity'

describe('request activity helper', () => {
    beforeEach(() => {
        resetRequestActivityStore()
    })

    test('tracks only the supported auxiliary modes', () => {
        expect(trackedRequestActivityModes).toEqual(['otherAx', 'submodel', 'translate'])
        expect(isTrackedRequestActivityMode('otherAx')).toBe(true)
        expect(isTrackedRequestActivityMode('submodel')).toBe(true)
        expect(isTrackedRequestActivityMode('translate')).toBe(true)
        expect(isTrackedRequestActivityMode('memory')).toBe(false)
        expect(isTrackedRequestActivityMode('emotion')).toBe(false)
    })

    test('ignores unsupported modes', () => {
        const state = startRequestActivity(createRequestActivityState(), 'memory', 100)

        expect(state.activeCount).toBe(0)
        expect(state.byMode).toEqual({
            otherAx: 0,
            submodel: 0,
            translate: 0,
        })
        expect(state.lastStartedAt).toBeNull()
    })

    test('counts overlapping requests by mode and total', () => {
        const first = startRequestActivity(createRequestActivityState(), 'otherAx', 100)
        const second = startRequestActivity(first, 'translate', 200)
        const third = startRequestActivity(second, 'otherAx', 300)
        const ended = endRequestActivity(third, 'otherAx')

        expect(first.activeCount).toBe(1)
        expect(first.byMode.otherAx).toBe(1)
        expect(first.lastStartedAt).toBe(100)

        expect(second.activeCount).toBe(2)
        expect(second.byMode.otherAx).toBe(1)
        expect(second.byMode.translate).toBe(1)
        expect(second.lastStartedAt).toBe(200)

        expect(third.activeCount).toBe(3)
        expect(third.byMode.otherAx).toBe(2)
        expect(third.byMode.translate).toBe(1)
        expect(third.lastStartedAt).toBe(300)

        expect(ended.activeCount).toBe(2)
        expect(ended.byMode.otherAx).toBe(1)
        expect(ended.byMode.translate).toBe(1)
        expect(ended.lastStartedAt).toBe(300)
    })

    test('builds a compact label for a single auxiliary mode', () => {
        const state = startRequestActivity(createRequestActivityState(), 'translate', 100)

        expect(getRequestActivityLabel(state)).toBe('번역 처리 중')
    })

    test('builds a compact label for a single auxiliary model request', () => {
        const state = startRequestActivity(createRequestActivityState(), 'submodel', 100)

        expect(getRequestActivityLabel(state)).toBe('보조 모델 처리 중')
    })

    test('builds a compact label for multiple auxiliary modes', () => {
        const state = startRequestActivity(
            startRequestActivity(createRequestActivityState(), 'otherAx', 100),
            'submodel',
            200,
        )

        expect(getRequestActivityLabel(state)).toBe('보조 요청 2개 처리 중')
    })

    test('tracks and clears store state around a successful async request', async () => {
        let resolveRequest: ((value: string) => void) | null = null
        const trackedPromise = withTrackedRequestActivity(
            'otherAx',
            () =>
                new Promise<string>((resolve) => {
                    resolveRequest = resolve
                }),
            123,
        )

        expect(get(requestActivityStore)).toEqual({
            activeCount: 1,
            byMode: {
                otherAx: 1,
                submodel: 0,
                translate: 0,
            },
            lastStartedAt: 123,
        })

        resolveRequest?.('done')

        await expect(trackedPromise).resolves.toBe('done')
        expect(get(requestActivityStore)).toEqual(createRequestActivityState())
    })

    test('clears tracked store state after a failed async request', async () => {
        await expect(
            withTrackedRequestActivity('translate', async () => {
                throw new Error('boom')
            }),
        ).rejects.toThrow('boom')

        expect(get(requestActivityStore)).toEqual(createRequestActivityState())
    })

    test('does not track unsupported modes in the async wrapper', async () => {
        await expect(withTrackedRequestActivity('memory', async () => 'ignored')).resolves.toBe(
            'ignored',
        )

        expect(get(requestActivityStore)).toEqual(createRequestActivityState())
    })

    test('keeps tracked state until a streaming response finishes', async () => {
        let streamController: ReadableStreamDefaultController<string> | null = null

        const response = await withTrackedRequestActivity('otherAx', async () => ({
            type: 'streaming' as const,
            result: new ReadableStream<string>({
                start(controller) {
                    streamController = controller
                },
            }),
        }))

        expect(get(requestActivityStore).activeCount).toBe(1)

        const reader = response.result.getReader()

        streamController?.enqueue('chunk-1')
        await expect(reader.read()).resolves.toEqual({
            done: false,
            value: 'chunk-1',
        })
        expect(get(requestActivityStore).activeCount).toBe(1)

        streamController?.close()
        await expect(reader.read()).resolves.toEqual({
            done: true,
            value: undefined,
        })
        expect(get(requestActivityStore)).toEqual(createRequestActivityState())
    })
})
