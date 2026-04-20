import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: 'script',
      devOptions: {
        enabled: true,
        type: 'module'
      },
      manifest: {
        id: 'com.expense.monitor',
        name: 'Expense Monitor',
        short_name: 'Monitor',
        description: 'Track your expenses directly from your mobile device',
        theme_color: '#0d9488',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['finance', 'utilities'],
        icons: [
          {
            src: '/app_logo.png',
            sizes: '500x500',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/app_logo.png',
            sizes: '500x500',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Add Expense',
            short_name: 'Add',
            description: 'Log a new expense quickly',
            url: '/add',
            icons: [{ src: '/app_logo.png', sizes: '500x500' }]
          }
        ],
        share_target: {
          action: '/add',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            files: [
              {
                name: 'file',
                accept: [
                  'image/jpeg', 
                  'image/png', 
                  'image/webp', 
                  'image/gif',
                  'image/bmp',
                  'image/heic',
                  'image/heif'
                ]
              }
            ]
          }
        }
      }
    })
  ],
  server: {
    port: 3000
  },
})
