import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/compat/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
