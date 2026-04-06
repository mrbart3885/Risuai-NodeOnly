import { describe, expect, test, vi } from 'vitest'

import { decideBackendStartup } from './dev-nodeonly-lib.mjs'

describe('decideBackendStartup', () => {
    test('starts the backend when the target port is free', async () => {
        const decision = await decideBackendStartup({
            port: 6001,
            isPortOpen: vi.fn(async () => false),
            fetchImpl: vi.fn(),
        })

        expect(decision).toBe('start')
    })

    test('reuses the running backend only when the health check matches the node-only server', async () => {
        const decision = await decideBackendStartup({
            port: 6001,
            isPortOpen: vi.fn(async () => true),
            fetchImpl: vi.fn(async () => new Response(JSON.stringify({ status: 'unset' }), {
                status: 200,
                headers: {
                    'content-type': 'application/json',
                },
            })),
        })

        expect(decision).toBe('reuse')
    })

    test('reports a conflict when another process occupies the backend port', async () => {
        const decision = await decideBackendStartup({
            port: 6001,
            isPortOpen: vi.fn(async () => true),
            fetchImpl: vi.fn(async () => new Response('not-rsnd', {
                status: 200,
                headers: {
                    'content-type': 'text/plain',
                },
            })),
        })

        expect(decision).toBe('conflict')
    })
})
