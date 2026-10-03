import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'NODIA_')
  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] })
    ],
    server: {
      port: 5174,
      strictPort: true,
      allowedHosts: ['.trycloudflare.com'],
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
      // One public origin for the UI and API, including HttpOnly refresh cookies.
      // Preserve Origin: Nodia Server must still authorize the actual caller.
      proxy: {
        '^/api/v1(?:/|$)': {
          target: env.NODIA_API_PROXY_TARGET || 'http://localhost:3000',
          changeOrigin: false,
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      include: ['src/test/**/*.test.{ts,tsx}'],
      testTimeout: 15000,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov'],
        reportsDirectory: './coverage',
      },
    },
  }
})
