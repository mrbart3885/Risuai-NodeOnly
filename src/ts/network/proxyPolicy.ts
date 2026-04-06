export type ProxyPolicy = 'auto' | 'always'

export function getFetchNativeTransport(arg: {
    throughProxy: boolean
    hasUserScriptFetch: boolean
}): 'proxy' | 'userscript' | 'direct' {
    if (arg.throughProxy) {
        return 'proxy'
    }

    if (arg.hasUserScriptFetch) {
        return 'userscript'
    }

    return 'direct'
}

export function shouldUseProxyForFetchNative(arg: {
    dbUsePlainFetch: boolean
    useLocalNetworkRoute: boolean
    proxyPolicy?: ProxyPolicy
}): boolean {
    if (arg.proxyPolicy === 'always') {
        return true
    }

    if (arg.useLocalNetworkRoute) {
        return true
    }

    return !arg.dbUsePlainFetch
}

export function shouldUseProxyForGlobalFetch(arg: {
    dbUsePlainFetch: boolean
    knownHostMatch: boolean
    plainFetchForce?: boolean
    plainFetchDeforce?: boolean
    useLocalNetworkRoute: boolean
    proxyPolicy?: ProxyPolicy
}): boolean {
    if (arg.proxyPolicy === 'always') {
        return true
    }

    if (arg.useLocalNetworkRoute) {
        return true
    }

    const forcePlainFetch =
        (arg.knownHostMatch || arg.dbUsePlainFetch || !!arg.plainFetchForce) && !arg.plainFetchDeforce

    return !forcePlainFetch
}
