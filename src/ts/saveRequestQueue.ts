export type SaveRequestOptions = {
    forceFullWrite?: boolean
    skipBroadcast?: boolean
    skipBackups?: boolean
}

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
