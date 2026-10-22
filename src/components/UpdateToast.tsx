import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * A-Cut 2Dpro — اطلاع‌رسانی بروزرسانی نسخهٔ وب (PWA)
 * ==================================================
 * `registerType` در `vite.config.ts` روی `'prompt'` است؛ یعنی وقتی نسخهٔ
 * جدید روی سایت منتشر شود، سرویس‌ورکر تازه دانلود و در وضعیت «منتظر» نگه
 * داشته می‌شود و رویداد `onNeedRefresh` فعال می‌گردد. این کامپوننت در آن
 * لحظه پیام «نسخهٔ جدید برنامه آماده است» را پایین صفحه نشان می‌دهد؛ با
 * کلیک روی «بروزرسانی»، سرویس‌ورکر جدید فعال و صفحه یک‌بار رفرش می‌شود.
 *
 * نکته‌ها:
 * - فضای کاری فعلی به‌صورت خودکار در localStorage ذخیره می‌شود (پیش‌نویس
 *   خودکار در `App.tsx`)، پس رفرش صفحه هیچ داده‌ای را از بین نمی‌برد.
 * - در بیلد `--mode app` (بستهٔ بومی اندروید/ویندوز) پلاگین PWA غیرفعال
 *   است و ماژول مجازی `virtual:pwa-register/react` یک پیاده‌سازی خنثی
 *   (Stub) برمی‌گرداند؛ `needRefresh` هرگز true نمی‌شود و این کامپوننت
 *   چیزی رندر نمی‌کند. (نسخهٔ اندروید با Live URL همان نسخهٔ وب را لود
 *   می‌کند، پس این اعلان داخل اپ اندروید هم کار می‌کند.)
 */

/** فاصلهٔ بررسی دوره‌ای نسخهٔ جدید (میلی‌ثانیه) — هر ساعت */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export default function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // بررسی دوره‌ای تا تب‌های بازِ طولانی هم از نسخهٔ جدید باخبر شوند
      window.setInterval(() => {
        registration.update().catch(() => {
          // آفلاین بودن کاربر هنگام بررسی طبیعی است؛ نادیده گرفته می‌شود
        });
      }, UPDATE_CHECK_INTERVAL_MS);
    },
    onRegisterError() {
      // ثبت سرویس‌ورکر ممکن است در برخی محیط‌ها (مثلاً حالت خصوصی مرورگر)
      // ناموفق باشد؛ برنامه بدون آن هم کامل کار می‌کند.
    },
  });

  // وقتی کاربر برمی‌گردد به تب برنامه، همان لحظه نسخهٔ جدید را چک می‌کنیم
  // تا لازم نباشد تا بررسی دوره‌ای بعدی صبر کند.
  useEffect(() => {
    const checkNow = () => {
      if (document.visibilityState !== 'visible') return;
      void navigator.serviceWorker
        ?.getRegistration()
        .then((registration) => registration?.update())
        .catch(() => {
          // بدون سرویس‌ورکر یا در حالت آفلاین؛ مشکلی نیست
        });
    };
    document.addEventListener('visibilitychange', checkNow);
    window.addEventListener('focus', checkNow);
    return () => {
      document.removeEventListener('visibilitychange', checkNow);
      window.removeEventListener('focus', checkNow);
    };
  }, []);

  if (!needRefresh) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 print:hidden"
    >
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl bg-slate-900/95 px-4 py-3 text-white shadow-2xl ring-1 ring-white/15 backdrop-blur">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white">
          {/* آیکون بروزرسانی */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
        </span>
        <p className="min-w-0 flex-1 text-[13px] font-semibold leading-6">
          نسخهٔ جدید برنامه آماده است.
          <span className="block text-[11px] font-normal text-slate-300">
            برای بروزرسانی کلیک کنید؛ کار فعلی شما ذخیره شده است.
          </span>
        </p>
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="shrink-0 rounded-xl bg-sky-600 px-3.5 py-2 text-[13px] font-bold text-white shadow transition hover:bg-sky-500 active:scale-95"
        >
          بروزرسانی
        </button>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          aria-label="بعداً"
          className="shrink-0 rounded-lg px-2 py-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
