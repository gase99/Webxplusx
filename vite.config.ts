import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // GitHub Pages این پروژه را زیر مسیر مخزن gase99/Webxplusx منتشر می‌کند
  base: '/Webxplusx/',
  plugins: [
    react(),
    tailwindcss(),
    // --- PWA: Manifest + Service Worker برای نصب‌پذیری و کار آفلاین ---
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'A-Cut 2Dpro | بهینه‌سازی برش دوبعدی ورق',
        short_name: 'A-Cut 2Dpro',
        description:
          'ورود اطلاعات قطعات، بهینه‌سازی چیدمان روی ورق خام، نقشهٔ برش، خروجی DXF و لیبل — قابل نصب و کارآفلاین',
        lang: 'fa',
        dir: 'rtl',
        theme_color: '#0284c7',
        background_color: '#f0f9ff',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // تمام خروجی‌های بیلد به‌صورت پیش‌ذخیره (Precache) برای کار آفلاین
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        // فونت‌های گوگل را هم آفلاین نگه می‌داریم
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-css',
              expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
});
