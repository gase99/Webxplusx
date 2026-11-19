import { useState } from 'react';
import { FREE_PROJECT_LIMIT, TELEGRAM_BOT_URL } from '../config/constants';
import { activateLicense, getDeviceId, type LicenseCheckReason } from '../lib/license';
import { logger } from '../lib/logger';

interface LockScreenProps {
  /** بعد از فعال‌سازی موفق لایسنس صدا زده می‌شود تا پوستهٔ برنامه نمایش داده شود */
  onUnlocked: () => void;
}

const REASON_MESSAGES: Record<Exclude<LicenseCheckReason, 'ok'>, string> = {
  missing: 'لایسنس وارد نشده است.',
  malformed: 'فرمت لایسنس درست نیست؛ کلید را کامل و بدون فاصله کپی کنید.',
  bad_signature: 'امضای لایسنس معتبر نیست — این کلید توسط ربات صادر نشده است.',
  device_mismatch: 'این لایسنس برای دستگاه دیگری صادر شده است.',
  expired: 'اعتبار این لایسنس تمام شده است؛ برای تمدید به ربات تلگرام مراجعه کنید.',
};

/**
 * صفحهٔ قفل برنامه — بعد از ذخیرهٔ `FREE_PROJECT_LIMIT` پروژه نمایش داده
 * می‌شود. کاربر از اینجا با یک دکمه وارد ربات تلگرام می‌شود، شناسهٔ دستگاه
 * را به ربات می‌دهد، لایسنس صادرشده را برمی‌گرداند و اینجا فعال می‌کند.
 */
export default function LockScreen({ onUnlocked }: LockScreenProps) {
  const deviceId = getDeviceId();
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const openTelegramBot = async () => {
    try {
      window.open(TELEGRAM_BOT_URL, '_blank', 'noopener,noreferrer');
    } catch (err) {
      logger.warn('باز کردن ربات تلگرام ناموفق بود', err);
      window.open(TELEGRAM_BOT_URL, '_blank', 'noopener,noreferrer');
    }
  };

  const copyDeviceId = async () => {
    try {
      await navigator.clipboard.writeText(deviceId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard در WebView محدود ممکن است در دسترس نباشد — کاربر دستی کپی می‌کند
      setCopied(false);
    }
  };

  const handleActivate = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await activateLicense(key);
    setBusy(false);
    if (result.valid) {
      onUnlocked();
    } else {
      setError(REASON_MESSAGES[result.reason as Exclude<LicenseCheckReason, 'ok'>]);
    }
  };

  return (
    <div className="lock-screen" role="dialog" aria-modal="true" aria-labelledby="lock-title">
      <div className="lock-card">
        <div className="lock-icon" aria-hidden="true">
          🔒
        </div>
        <h1 id="lock-title" className="lock-title">
          نسخهٔ رایگان به پایان رسید
        </h1>
        <p className="lock-text">
          شما {FREE_PROJECT_LIMIT.toLocaleString('fa-IR')} پروژهٔ رایگان را استفاده کرده‌اید. برای ادامهٔ
          کار با A-Cut 2Dpro، لایسنس تهیه کنید.
        </p>

        <div className="lock-device">
          <span className="lock-device-label">شناسهٔ دستگاه شما (برای ربات لازم است):</span>
          <div className="lock-device-row">
            <code className="lock-device-id" dir="ltr">
              {deviceId}
            </code>
            <button type="button" className="btn btn-secondary" onClick={copyDeviceId}>
              {copied ? 'کپی شد ✓' : 'کپی'}
            </button>
          </div>
        </div>

        <button type="button" className="btn btn-primary lock-telegram" onClick={openTelegramBot}>
          ✈️ دریافت لایسنس از تلگرام
        </button>

        <div className="lock-divider">یا لایسنس دارید؟</div>

        <label className="lock-field">
          <span>کلید لایسنس را وارد کنید:</span>
          <textarea
            className="lock-input"
            dir="ltr"
            rows={3}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="XXXX.YYYY"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </label>
        {error && (
          <p className="lock-error" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          className="btn btn-primary lock-activate"
          onClick={handleActivate}
          disabled={busy || key.trim().length === 0}
        >
          {busy ? 'در حال بررسی…' : 'فعال‌سازی لایسنس'}
        </button>
      </div>
    </div>
  );
}
