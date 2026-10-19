import { useEffect, useState } from 'react';
import { DownloadIcon } from './icons';

/**
 * رویداد نصبِ پیش‌فرض مرورگر — قبل از اینکه مرورگر آن را رها کند
 * باید preventDefault شود تا بتوانیم بعداً آن را فراخوانی کنیم.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * دکمهٔ «نصب برنامه» در هدر (فاز ۶: PWA)
 * -------------------------------------------------
 * - در مرورگرهایی که نصب پیش‌فرض را پشتیبانی می‌کنند (Chrome/Edge
 *   اندروید، موبایل و ...) نمایش داده می‌شود.
 * - در مرورگرهای بدون پشتیبانی (مثلاً iOS Safari که از دکمهٔ
 *   اشتراک‌گذاری استفاده می‌کند) خفته می‌ماند.
 * - بعد از نصب (رویداد appinstalled) یا در حالت نصب‌شده
 *   (display-mode: standalone) دیده نمی‌شود.
 */
export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // اگر برنامه از قبل نصب شده باشد، دکمه نمایش داده نشود
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ?? false;
    if (standalone) return;

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault(); // مرورگر نوار ابزار خودش را نشان نمی‌دهد
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => setDeferredPrompt(null);

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  if (!deferredPrompt) return null;

  const handleInstall = async () => {
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } catch {
      // کاربر گزینه را بست — بی‌خیال می‌شویم
    }
    setDeferredPrompt(null);
  };

  return (
    <button
      type="button"
      onClick={handleInstall}
      title="نصب برنامه روی دستگاه — آفلاین هم کار می‌کند"
      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-sm ring-1 ring-sky-500 transition hover:bg-sky-500"
    >
      <DownloadIcon className="h-4 w-4" />
      نصب برنامه
    </button>
  );
}
