export type SaveRequestOptions = {
    forceFullWrite?: boolean
    skipBroadcast?: boolean
    skipBackups?: boolean
}

type SaveRequest = (options?: SaveRequestOptions) => Promise<void> | void
type SaveErrorHandler = (error: unknown) => void

export function mergeSaveRequestOptions(
    pending: SaveRequestOptions | null,
    next?: SaveRequestOptions
): SaveRequestOptions | null {
    if (!pending) {
        return next ? { ...next } : null
    }

    if (!next) {
        return { ...pending }
    }

    return {
        forceFullWrite: !!pending.forceFullWrite || !!next.forceFullWrite,
        skipBroadcast: !!pending.skipBroadcast && !!next.skipBroadcast,
        skipBackups: !!pending.skipBackups && !!next.skipBackups,
    }
}

export function consumeSaveRequestOptions(
    pending: SaveRequestOptions | null,
    next?: SaveRequestOptions
): {
    effective: SaveRequestOptions | null
    pending: null
} {
    return {
        effective: mergeSaveRequestOptions(pending, next),
        pending: null,
    }
}

export async function requestSaveBestEffort(
    requestSave: SaveRequest,
    options?: SaveRequestOptions,
    onError: SaveErrorHandler = console.error
) {
    try {
        await requestSave(options)
    } catch (error) {
        onError(error)
    }
}

export function requestSaveInBackground(
    requestSave: SaveRequest,
    options?: SaveRequestOptions,
    onError: SaveErrorHandler = console.error
) {
    try {
        void Promise.resolve(requestSave(options)).catch((error) => {
            onError(error)
        })
    } catch (error) {
        onError(error)
    }
}
