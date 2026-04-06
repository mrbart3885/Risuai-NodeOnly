import { writable } from 'svelte/store'

export const trackedRequestActivityModes = ['otherAx', 'submodel', 'translate'] as const

export type RequestActivityMode = (typeof trackedRequestActivityModes)[number]

export type RequestActivityState = {
    activeCount: number
    byMode: Record<RequestActivityMode, number>
    lastStartedAt: number | null
}

export function createRequestActivityState(): RequestActivityState {
    return {
        activeCount: 0,
        byMode: {
            otherAx: 0,
            submodel: 0,
            translate: 0,
        },
        lastStartedAt: null,
    }
}

export function isTrackedRequestActivityMode(mode: string): mode is RequestActivityMode {
    return trackedRequestActivityModes.includes(mode as RequestActivityMode)
}

export function startRequestActivity(
    state: RequestActivityState,
    mode: string,
    startedAt = Date.now(),
): RequestActivityState {
    if (!isTrackedRequestActivityMode(mode)) {
        return state
    }

    return {
        activeCount: state.activeCount + 1,
        byMode: {
            ...state.byMode,
            [mode]: state.byMode[mode] + 1,
        },
        lastStartedAt: startedAt,
    }
}

export function endRequestActivity(state: RequestActivityState, mode: string): RequestActivityState {
    if (!isTrackedRequestActivityMode(mode)) {
        return state
    }

    if (state.byMode[mode] <= 0) {
        return state
    }

    const activeCount = Math.max(0, state.activeCount - 1)
    return {
        activeCount,
        byMode: {
            ...state.byMode,
            [mode]: state.byMode[mode] - 1,
        },
        lastStartedAt: activeCount > 0 ? state.lastStartedAt : null,
    }
}

export function getRequestActivityLabel(state: RequestActivityState): string {
    if (state.activeCount <= 0) {
        return ''
    }

    if (state.activeCount === 1) {
        if (state.byMode.translate > 0) {
            return '번역 처리 중'
        }
        return '보조 모델 처리 중'
    }

    return `보조 요청 ${state.activeCount}개 처리 중`
}

export const requestActivityStore = writable(createRequestActivityState())

export function resetRequestActivityStore(): void {
    requestActivityStore.set(createRequestActivityState())
}

function isStreamingRequestActivityResult(
    value: unknown,
): value is { type: 'streaming'; result: ReadableStream<unknown> } {
    return (
        typeof value === 'object' &&
        value !== null &&
        'type' in value &&
        value.type === 'streaming' &&
        'result' in value &&
        value.result instanceof ReadableStream
    )
}

function wrapTrackedStream<T>(
    stream: ReadableStream<T>,
    onFinish: () => void,
): ReadableStream<T> {
    let finished = false
    let reader: ReadableStreamDefaultReader<T> | null = null
    const finish = () => {
        if (!finished) {
            finished = true
            onFinish()
        }
    }

    return new ReadableStream<T>({
        start(controller) {
            reader = stream.getReader()

            const pump = async (): Promise<void> => {
                try {
                    while (true) {
                        const { done, value } = await reader!.read()
                        if (done) {
                            finish()
                            controller.close()
                            return
                        }
                        controller.enqueue(value)
                    }
                } catch (error) {
                    finish()
                    controller.error(error)
                }
            }

            return pump()
        },
        async cancel(reason) {
            try {
                if (reader) {
                    await reader.cancel(reason)
                } else {
                    await stream.cancel(reason)
                }
            } finally {
                finish()
            }
        },
    })
}

export async function withTrackedRequestActivity<T>(
    mode: string,
    run: () => Promise<T>,
    startedAt = Date.now(),
): Promise<T> {
    const tracked = isTrackedRequestActivityMode(mode)
    let finished = false
    const finish = () => {
        if (tracked && !finished) {
            finished = true
            requestActivityStore.update((state) => endRequestActivity(state, mode))
        }
    }

    if (tracked) {
        requestActivityStore.update((state) => startRequestActivity(state, mode, startedAt))
    }

    try {
        const result = await run()

        if (tracked && isStreamingRequestActivityResult(result)) {
            return {
                ...result,
                result: wrapTrackedStream(result.result, finish),
            } as T
        }

        finish()
        return result
    } catch (error) {
        finish()
        throw error
    }
}
