import type { CapacitorConfig } from '@capacitor/cli';

/**
 * A-Cut 2Dpro — پیکربندی Capacitor (نسخهٔ اندروید)
 * -------------------------------------------------
 * `webDir: 'dist'` یعنی خروجی Vite (که با `npm run build:app` و base نسبی
 * ساخته می‌شود) منبع بستهٔ داخل اپ است؛ `npx cap sync android` همین پوشه را
 * به `android/app/src/main/assets/public` کپی می‌کند.
 */
const config: CapacitorConfig = {
  appId: 'com.acut.cut2dpro',
  appName: 'A-Cut 2Dpro',
  webDir: 'dist',
  server: {
    // محتوای محلی با https://localhost سرو می‌شود تا IndexedDB/Dexie و
    // قابلیت‌های WebView بدون محدودیت مبدأ کار کنند.
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#e2e8f0',
  },
};

export default config;
