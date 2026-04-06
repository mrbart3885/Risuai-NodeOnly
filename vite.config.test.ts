import { describe, expect, test } from 'vitest'

import viteConfig from './vite.config'

describe('vite dev config', () => {
    test('proxies node-only backend routes to the local node server', async () => {
        const config = await viteConfig({
            command: 'serve',
            mode: 'development',
            isSsrBuild: false,
            isPreview: false,
        } as any)

        const proxy = config.server?.proxy
        expect(proxy).toBeDefined()
        expect(proxy?.['/api']).toMatchObject({
            target: 'http://127.0.0.1:6001',
            changeOrigin: true,
        })
        expect(proxy?.['/hub-proxy']).toMatchObject({
            target: 'http://127.0.0.1:6001',
            changeOrigin: true,
        })
        expect(proxy?.['/proxy2']).toMatchObject({
            target: 'http://127.0.0.1:6001',
            changeOrigin: true,
        })
        expect(proxy?.['/proxy-stream-jobs']).toMatchObject({
            target: 'http://127.0.0.1:6001',
            changeOrigin: true,
        })
    })

    test('tracks the backend PORT override for every proxied route', async () => {
        const previousPort = process.env.PORT
        process.env.PORT = '7001'

        try {
            const config = await viteConfig({
                command: 'serve',
                mode: 'development',
                isSsrBuild: false,
                isPreview: false,
            } as any)

            const proxy = config.server?.proxy
            expect(proxy?.['/api']).toMatchObject({
                target: 'http://127.0.0.1:7001',
            })
            expect(proxy?.['/hub-proxy']).toMatchObject({
                target: 'http://127.0.0.1:7001',
            })
            expect(proxy?.['/proxy2']).toMatchObject({
                target: 'http://127.0.0.1:7001',
            })
            expect(proxy?.['/proxy-stream-jobs']).toMatchObject({
                target: 'http://127.0.0.1:7001',
            })
        } finally {
            if (previousPort === undefined) {
                delete process.env.PORT
            } else {
                process.env.PORT = previousPort
            }
        }
    })
})
