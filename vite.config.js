import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Använder befintlig manifest.webmanifest i public/ — sätter
      // useCredentials så att den hämtas med samma cookies som appen.
      manifest: false,
      includeAssets: [
        'favicon.ico',
        'favicon.svg',
        'apple-touch-icon.png',
        'manifest.webmanifest',
      ],
      workbox: {
        // Precache alla byggda assets för snabb start och offline-stöd.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        // Network-first för Supabase API och edge-functions — vi vill
        // aldrig servera gammal data från cache.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co'),
            handler: 'NetworkOnly',
          },
        ],
        // Navigations-fallback: om en route saknas i cache, fall tillbaka
        // på index.html (SPA-pattern).
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /\/functions\//],
      },
      devOptions: {
        // Aktivera SW i dev-läge så vi kan testa beteendet utan att bygga.
        enabled: false,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
