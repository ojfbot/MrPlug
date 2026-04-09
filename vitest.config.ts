import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    environmentMatchGlobs: [
      ['src/lib/__tests__/element-capture.test.ts', 'happy-dom'],
      ['src/lib/__tests__/storage.test.ts', 'happy-dom'],
    ],
    exclude: [
      'e2e/**',
      'node_modules/**',
      'dist/**',
      'mrplug-mcp-server/**',  // requires relay server to be running
    ],
  },
})
