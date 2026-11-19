import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * پیکربندی تست واحد (Vitest).
 * از `vite.config.ts` جدا است تا پلاگین‌های PWA/Tailwind در محیط تست بار نشوند؛
 * به‌جای آن، ماژول مجازی `virtual:pwa-register/react` به یک Stub ساده وصل
 * می‌شود تا کامپوننت‌های رابط بدون سرویس‌ورکر تست شوند.
 */
export default defineConfig({
  resolve: {
    alias: {
      'virtual:pwa-register/react': fileURLToPath(
        new URL('./src/test/pwaRegisterStub.ts', import.meta.url),
      ),
      'virtual:pwa-register': fileURLToPath(new URL('./src/test/pwaRegisterStub.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    reporters: 'default',
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 30_000,
  },
});
