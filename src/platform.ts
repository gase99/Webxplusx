import { Capacitor } from '@capacitor/core';

/**
 * A-Cut 2Dpro — تشخیص محیط اجرا برای انتخاب روش خروجی
 * ===================================================
 * دستور `window.print()` در WebView اندروید (نسخهٔ APK) و در PWA نصب‌شده
 * روی گوشی پشتیبانی نمی‌شود/کار نمی‌کند؛ بنابراین در این محیط‌ها به‌جای
 * چاپ مستقیم، همان سند به فایل PDF تبدیل می‌شود (به `exportPdf.ts` نگاه
 * کنید). روی مرورگر دسکتاپ چاپ مستقیم همچنان بهترین خروجی را می‌دهد.
 */

/** آیا داخل اپ بومی Capacitor (اندروید/APK) اجرا می‌شویم؟ */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/** آیا برنامه به‌صورت PWA نصب‌شده (standalone) باز شده است؟ */
export function isInstalledPwa(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  if (window.matchMedia?.('(display-mode: fullscreen)').matches) return true;
  // آیفون/آیپد: فلگ اختصاصی سافاری برای وب‌اپ نصب‌شده روی صفحهٔ خانه
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** تشخیص گوشی/تبلت از روی User-Agent (+ آیپد با UA دسکتاپ) */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)) {
    return true;
  }
  // از iPadOS 13 به بعد سافاری آیپد UA دسکتاپ (Macintosh) می‌فرستد؛
  // Macintosh + لمسی‌بودن دستگاه نشانهٔ قابل‌اتکای آیپد است.
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return true;
  return false;
}

/**
 * در این محیط‌ها `window.print()` قابل اتکا نیست و دکمه‌های «چاپ» باید
 * به خروجی PDF هدایت شوند: اپ بومی، گوشی/تبلت و PWA نصب‌شده.
 */
export function prefersPdfExport(): boolean {
  return isNativeApp() || isMobileDevice() || isInstalledPwa();
}
