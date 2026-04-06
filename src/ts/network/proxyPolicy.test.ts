import { describe, expect, test } from 'vitest'
import {
    getFetchNativeTransport,
    shouldUseProxyForFetchNative,
    shouldUseProxyForGlobalFetch,
} from './proxyPolicy'

describe('proxy policy helpers', () => {
    test('force proxy overrides direct fetch toggles everywhere', () => {
        expect(
            shouldUseProxyForFetchNative({
                dbUsePlainFetch: true,
                useLocalNetworkRoute: false,
                proxyPolicy: 'always',
            }),
        ).toBe(true)

        expect(
            shouldUseProxyForGlobalFetch({
                dbUsePlainFetch: true,
                knownHostMatch: true,
                plainFetchForce: true,
                plainFetchDeforce: false,
                useLocalNetworkRoute: false,
                proxyPolicy: 'always',
            }),
        ).toBe(true)
    })

    test('auto mode keeps existing behavior', () => {
        expect(
            shouldUseProxyForFetchNative({
                dbUsePlainFetch: true,
                useLocalNetworkRoute: false,
                proxyPolicy: 'auto',
            }),
        ).toBe(false)

        expect(
            shouldUseProxyForGlobalFetch({
                dbUsePlainFetch: false,
                knownHostMatch: false,
                plainFetchForce: false,
                plainFetchDeforce: false,
                useLocalNetworkRoute: false,
                proxyPolicy: 'auto',
            }),
        ).toBe(true)
    })

    test('fetchNative transport respects forced proxy before direct fetch', () => {
        expect(
            getFetchNativeTransport({
                throughProxy: true,
                hasUserScriptFetch: true,
            }),
        ).toBe('proxy')

        expect(
            getFetchNativeTransport({
                throughProxy: false,
                hasUserScriptFetch: true,
            }),
        ).toBe('userscript')

        expect(
            getFetchNativeTransport({
                throughProxy: false,
                hasUserScriptFetch: false,
            }),
        ).toBe('direct')
    })
})
