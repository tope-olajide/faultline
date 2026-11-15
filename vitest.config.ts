import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    cache: true,
  },
  resolve: {
    alias: [
      {
        find: '@/',
        replacement: '/src/',
      } as const,
    ],
  },
})