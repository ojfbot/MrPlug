import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: [
      'e2e/**',
      'node_modules/**',
      'dist/**',
      'mrplug-mcp-server/**',  // requires relay server to be running
    ],
  },
})
