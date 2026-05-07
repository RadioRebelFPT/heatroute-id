import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load all env vars (no prefix filter) so we can read ORS_API_KEY
  // server-side for the dev proxy without exposing it to the client bundle.
  const env = loadEnv(mode, process.cwd(), '')
  const orsKey = env.ORS_API_KEY ?? env.VITE_ORS_API_KEY ?? ''

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        // Mirror the production /api/ors-proxy serverless function in dev:
        // the client always calls /api/ors-proxy with the same body, and the
        // proxy injects the Authorization header server-side.
        '/api/ors-proxy': {
          target: 'https://api.openrouteservice.org',
          changeOrigin: true,
          rewrite: () => '/v2/directions/foot-walking/geojson',
          headers: {
            Authorization: orsKey,
          },
        },
      },
    },
  }
})
