import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

const baseConfig =
  typeof viteConfig === 'function'
    ? viteConfig({ command: 'serve', mode: 'test' })
    : viteConfig

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      environment: 'happy-dom',
      exclude: [...configDefaults.exclude, 'test/compat/**/*.test.ts'],
      setupFiles: ['src/ts/polyfill.ts'],
    },
  })
)
