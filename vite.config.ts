import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { cpSync } from 'node:fs'

// The app is served from a subfolder on the cPanel server.
const BASE = '/dev/GymBuddy/'

// Copy the PHP backend into dist/ after each build so the whole app — frontend +
// api (incl. config.php) — is one deployable folder you can sync in a single step.
// Runs in closeBundle (after Vite has emptied & written dist), so it isn't wiped,
// and after the PWA plugin so the .php files are never added to the precache.
function copyApiToDist() {
  return {
    name: 'copy-api-to-dist',
    enforce: 'post' as const,
    closeBundle() {
      cpSync('api', 'dist/api', { recursive: true })
    },
  }
}

export default defineConfig({
  base: BASE,
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
  server: {
    port: 5173,
    // During local dev, proxy API calls to the local PHP server (npm run api).
    proxy: {
      '/dev/GymBuddy/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/dev\/GymBuddy\/api/, ''),
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon.ico', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'GymBuddy',
        short_name: 'GymBuddy',
        description: 'Create, run and log your gym workouts.',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f1115',
        theme_color: '#0f1115',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Never cache the API; always go to network for data.
        navigateFallbackDenylist: [/\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/api/'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
    copyApiToDist(),
  ],
})
