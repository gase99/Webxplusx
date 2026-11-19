import { useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { STORAGE_KEYS, UPDATE_CHECK_INTERVAL_MS } from '../config/constants';
import { logger } from '../lib/logger';

/**
 * A-Cut 2Dpro — اطلاع‌رسانی بروزرسانی نسخهٔ وب (PWA)
 * ==================================================
 * `registerType` در `vite.config.ts` روی `'prompt'` است؛ یعنی نسخهٔ جدید
 * دانلود و در وضعیت «منتظر» نگه داشته می‌شود تا کاربر تأیید کند.
 *
 * باگ‌هایی که در این نسخه رفع شده‌اند:
 *  ۱) **نشتی تایمر بررسی دوره‌ای**: `setInterval` ثبت می‌شد و هیچ‌جا پاک
 *     نمی‌شد؛ با هر بار mount (از جمله StrictMode که دو بار mount می‌کند)
 *     یک تایمر جدید باقی می‌ماند. حالا با `useRef` نگه‌داری و در cleanup
 *     پاک می‌شود.
 *  ۲) **ناپدیدشدن دائمی اعلان با «بعداً»**: با بستن اعلان، در همان نشست دیگر
 *     هرگز نمایش داده نمی‌شد و کاربر می‌توانست روزها با نسخهٔ قدیمی (و
 *     کش‌های ناهم‌خوان) کار کند. حالا «بعداً» در localStorage با زمان ثبت
 *     می‌شود و اعلان بعد از یک بازهٔ خنک‌شدن (۳۰ دقیقه) دوباره ظاهر می‌شود؛
 *     ضمناً «نسخهٔ جدید» در صفحهٔ «بیشتر» هم قابل بررسی دستی است.
 *  ۳) **حالت نیمه‌فعال‌شدهٔ سرویس‌ورکر**: اگر صفحه بدون reload با کنترلر
 *     جدید ادامه پیدا کند، ممکن است بخشی از منابع از کش قدیمی و بخشی از
 *     کش جدید بیاید (نسخهٔ ناهم‌خوان). با گوش‌دادن به `controllerchange`
 *     فقط یک‌بار صفحه reload می‌شود (پیش‌نویس خودکار کار را حفظ می‌کند).
 *  ۴) **نسخهٔ منتظرِ از قبل موجود**: اگر کاربر صفحه را ببندد و بعداً با یک
 *     سرویس‌ورکر «منتظر» برگردد، `needRefresh` ممکن است false باشد؛ در
 *     startup مقدار `registration.waiting` هم بررسی می‌شود.
 */

/** بازهٔ خنک‌شدن پس از «بعداً» تا اعلان دوباره مزاحم نشود (۳۰ دقیقه) */
const DISMISS_COOLDOWN_MS = 30 * 60 * 1000;

function readDismissedAt(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.updateDismissed);
    const value = raw ? Number(raw) : 0;
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function writeDismissedAt(timestamp: number): void {
  try {
    localStorage.setItem(STORAGE_KEYS.updateDismissed, String(timestamp));
  } catch {
    // بدون حافظه هم اعلان کار می‌کند
  }
}

export default function UpdateToast() {
  const intervalRef = useRef<number | null>(null);
  const reloadingRef = useRef(false);
  /** اعلان به‌خاطر «بعداً» موقتاً پنهان است */
  const [dismissedNow, setDismissedNow] = useState(() => {
    const dismissedAt = readDismissedAt();
    return Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;
  });

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // نسخهٔ منتظرِ از قبل موجود (کاربر صفحه را قبلاً بسته است)
      if (registration.waiting) setNeedRefresh(true);
      // بررسی دوره‌ای؛ فقط یک تایمر فعال، با پاک‌سازی در unmount
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = window.setInterval(() => {
        registration.update().catch(() => {
          // آفلاین بودن کاربر هنگام بررسی طبیعی است
        });
      }, UPDATE_CHECK_INTERVAL_MS);
    },
    onRegisterError(error) {
      logger.warn('ثبت سرویس‌ورکر ناموفق بود (برنامه بدون آن هم کار می‌کند)', error);
    },
  });

  // بررسی فوری هنگام بازگشت به برنامه + بررسی دستی از صفحهٔ «بیشتر»
  useEffect(() => {
    const checkNow = () => {
      if (document.visibilityState !== 'visible') return;
      void navigator.serviceWorker
        ?.getRegistration()
        .then((registration) => registration?.update())
        .catch(() => {
          // بدون سرویس‌ورکر یا آفلاین
        });
    };
    const manualCheck = () => {
      // «بررسی نسخهٔ جدید» در صفحهٔ بیشتر: خنک‌شدن را نادیده می‌گیریم
      try {
        localStorage.removeItem(STORAGE_KEYS.updateDismissed);
      } catch {
        // نادیده
      }
      setDismissedNow(false);
      checkNow();
    };
    document.addEventListener('visibilitychange', checkNow);
    window.addEventListener('focus', checkNow);
    window.addEventListener('acut:check-update', manualCheck as EventListener);
    return () => {
      document.removeEventListener('visibilitychange', checkNow);
      window.removeEventListener('focus', checkNow);
      window.removeEventListener('acut:check-update', manualCheck as EventListener);
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // اگر کنترلر سرویس‌ورکر عوض شد ولی صفحه reload نشد، یک‌بار خودمان reload می‌کنیم
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onControllerChange = () => {
      if (reloadingRef.current) return;
      reloadingRef.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  }, []);

  const dismiss = () => {
    writeDismissedAt(Date.now());
    setDismissedNow(true);
    // نسخهٔ جدید کش‌شده می‌ماند؛ در نشست بعدی/PWA بعدی خودکار فعال می‌شود
    setNeedRefresh(false);
  };

  if (!needRefresh || dismissedNow) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed inset-x-0 z-50 flex justify-center px-4 print:hidden"
      style={{ bottom: 'calc(var(--bottom-nav-height) + var(--safe-bottom) + 0.75rem)' }}
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
          <span className="mt-0.5 block text-[11px] font-normal text-slate-300">
            برای بروزرسانی کلیک کنید؛ کار فعلی شما در پیش‌نویس خودکار ذخیره شده است.
          </span>
        </p>
        <button
          type="button"
          onClick={() => {
            reloadingRef.current = true;
            void updateServiceWorker(true);
          }}
          className="shrink-0 rounded-xl bg-sky-600 px-3.5 py-2 text-[13px] font-bold text-white shadow transition hover:bg-sky-500 active:scale-95"
        >
          بروزرسانی
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="بعداً — یادآوری پس از ۳۰ دقیقه"
          title="بعداً (یادآوری پس از ۳۰ دقیقه)"
          className="shrink-0 rounded-lg px-2 py-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
