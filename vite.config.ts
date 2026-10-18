import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => ({
  // در GitHub Pages پروژه زیر مسیر /acut-2dpro/ سرو می‌شود؛ بقیه محیط‌ها ریشه
  // (Workflow با دستور build --mode pages اجرا می‌شود)
  base: mode === 'pages' ? '/acut-2dpro/' : '/',
  plugins: [react(), tailwindcss()],
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
}));
