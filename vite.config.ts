import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/jobtracker/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Job Tracker',
        short_name: 'Jobs',
        description: 'Трекер откликов на вакансии: доска, фокус на сегодня, аналитика.',
        lang: 'ru',
        theme_color: '#0d0b1f',
        background_color: '#0d0b1f',
        display: 'standalone',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}', 'assets/*-{latin,cyrillic}-wght-normal-*.woff2'],
      },
    }),
  ],
});
