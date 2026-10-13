import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))


export default defineConfig({
  // Rutas RELATIVAS: la app funciona colgada de cualquier prefijo de URL (p. ej. detrás de un API Gateway en /algo/); no tiene router por URL.
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Atravieso y Paralelismo Mobile',
        short_name: 'AyP Mobile',
        description: 'App Atravieso y Paralelismo Mobile',
        theme_color: '#ffffff',
        start_url: './',
        scope: './',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        // config.js (dirección del backend) cambia con el despliegue: no se precachea con una copia vieja; la red manda y, sin conexión, vale la última.
        globIgnores: ['config.js'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('/config.js'),
            handler: 'NetworkFirst',
            options: { cacheName: 'ayp-config', networkTimeoutSeconds: 3 },
          },
        ],
      },
    })
  ],
  build: {
    outDir: 'dist'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
