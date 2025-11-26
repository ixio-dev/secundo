import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
  },
  plugins: [
    {
      name: 'load-sh-files',
      transform(code, id) {
        if (id.endsWith('.sh')) {
          return {
            code: `export default ${JSON.stringify(code)}`,
            map: null
          }
        }
      }
    }
  ]
})
