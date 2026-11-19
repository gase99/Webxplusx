import type { CapacitorConfig } from '@capacitor/cli';

/**
 * A-Cut 2Dpro — پیکربندی Capacitor (نسخهٔ اندروید)
 * -------------------------------------------------
 * حالت «بارگذاری زنده» (Live URL): اپ اندروید یک پوستهٔ بومی (WebView) است
 * که هنگام اجرا آخرین نسخهٔ منتشرشدهٔ وب را از GitHub Pages بارگذاری
 * می‌کند. در نتیجه با هر انتشار نسخهٔ وب، کاربران اندروید خودکار آخرین
 * نسخه را می‌بینند و نیازی به ساخت و نصب APK جدید نیست (به‌روزرسانی‌های
 * داخل خود صفحه هم با همان مکانیزم PWA و پیام «نسخهٔ جدید آماده است»
 * انجام می‌شود).
 *
 * پیامدهای این انتخاب (آگاهانه):
 * - اجرای اپ به اینترنت نیاز دارد؛ وقتی بارگذاری سایت موفق نباشد،
 *   Capacitor صفحهٔ خطای محلی `offline.html` را نشان می‌دهد (errorPath).
 * - داده‌های برنامه (IndexedDB پروژه‌ها و پیش‌نویس خودکار) روی مبدأ
 *   `https://gase99.github.io` ذخیره می‌شوند؛ پس پروژه‌های ذخیره‌شده در
 *   APKهای قدیمی (مبدأ `https://localhost`) در این نسخه دیده نمی‌شوند.
 *
 * با این حال خروجی `dist` (ساخته‌شده با `npm run build:app`) همچنان داخل
 * APK کپی می‌شود تا Capacitor فایل `offline.html` را در بستهٔ محلی داشته
 * باشد و `cap sync` انجام‌پذیر بماند.
 */
const config: CapacitorConfig = {
  appId: 'com.acut.cut2dpro',
  appName: 'A-Cut 2Dpro',
  webDir: 'dist',
  server: {
    // بارگذاری زنده: همیشه آخرین نسخهٔ وب از GitHub Pages
    url: 'https://gase99.github.io/Webxplusx/',
    // برای اطمینان از بارگذاری صحیح همهٔ منابع (حتی منابع http احتمالی)
    cleartext: true,
    // صفحهٔ خطای محلی در صورت نبود اینترنت یا خطای بارگذاری — از بستهٔ
    // داخل APK (`public/offline.html` در خروجی بیلد) خوانده می‌شود.
    errorPath: 'offline.html',
    // اسکیمای سرویس‌دهی صفحهٔ خطای محلی
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#edf2fa',
  },
  plugins: {
    /**
     * ناحیهٔ امن (safe-area) — اندروید ۱۵ به بالا اجباراً edge-to-edge است.
     * `insetsHandling: 'native'` یعنی Capacitor خودش WebView را با padding
     * می‌نشاند و مقادیر `env(safe-area-inset-*)` را درست تنظیم می‌کند؛
     * `initialViewportFitValueHint: 'cover'` از پرش چیدمان اولیه جلوگیری
     * می‌کند (هم‌خوان با `viewport-fit=cover` در index.html).
     * React فقط با همین متغیرها فاصلهٔ بالا (نوار وضعیت) و پایین (نوار
     * ناوبری/گِرد-ناوبری) را رعایت می‌کند — بدون هیچ نوار عنوانی بومی.
     */
    SystemBars: {
      insetsHandling: 'native',
      initialViewportFitValueHint: 'cover',
    },
  },
};

export default config;
