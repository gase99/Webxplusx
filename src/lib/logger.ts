/**
 * A-Cut 2Dpro — ابزار لاگ متمرکز
 * ==============================
 * به‌جای `console.log/error` پراکنده در کد، همهٔ پیام‌های تشخیصی از اینجا
 * عبور می‌کنند:
 *
 *  - در حالت توسعه (`import.meta.env.DEV`) در کنسول چاپ می‌شوند.
 *  - در بیلد نهایی هیچ نوشتنی روی کنسول انجام نمی‌شود (مگر خطای سطح
 *    `error` که برای پشتیبانی مفید است و فقط یک‌بار خلاصه می‌شود).
 *  - همهٔ رکوردها در یک بافر حلقه‌ای (حداکثر {@link LOG_BUFFER_LIMIT})
 *    نگه داشته می‌شوند تا صفحهٔ «بیشتر» بتواند آخرین رخدادها را برای
 *    عیب‌یابی نشان دهد.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogRecord {
  level: LogLevel;
  message: string;
  /** جزئیات سریالایز‌شده (اگر قابل تبدیل نبود، متن خام) */
  detail?: string;
  timestamp: number;
}

/** حداکثر تعداد رکورد نگه‌داری‌شده در حافظه */
export const LOG_BUFFER_LIMIT = 200;

const buffer: LogRecord[] = [];
const listeners = new Set<(records: readonly LogRecord[]) => void>();

/** آیا در بیلد توسعه‌ای هستیم؟ (در تست/SSR امن است) */
function isDev(): boolean {
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}

function serialize(detail: unknown): string | undefined {
  if (detail === undefined) return undefined;
  if (detail instanceof Error) {
    return `${detail.name}: ${detail.message}`;
  }
  if (typeof detail === 'string') return detail;
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

function record(level: LogLevel, message: string, detail?: unknown): LogRecord {
  const entry: LogRecord = {
    level,
    message,
    detail: serialize(detail),
    timestamp: Date.now(),
  };
  buffer.push(entry);
  if (buffer.length > LOG_BUFFER_LIMIT) buffer.splice(0, buffer.length - LOG_BUFFER_LIMIT);
  for (const listener of listeners) {
    try {
      listener(buffer);
    } catch {
      // شنوندهٔ معیوب نباید خودِ لاگ را بشکند
    }
  }
  return entry;
}

const sink = {
  debug: (...args: unknown[]) => console.debug('[A-Cut 2Dpro]', ...args),
  info: (...args: unknown[]) => console.info('[A-Cut 2Dpro]', ...args),
  warn: (...args: unknown[]) => console.warn('[A-Cut 2Dpro]', ...args),
  error: (...args: unknown[]) => console.error('[A-Cut 2Dpro]', ...args),
};

export const logger = {
  debug(message: string, detail?: unknown): void {
    record('debug', message, detail);
    if (isDev()) sink.debug(message, detail ?? '');
  },
  info(message: string, detail?: unknown): void {
    record('info', message, detail);
    if (isDev()) sink.info(message, detail ?? '');
  },
  warn(message: string, detail?: unknown): void {
    record('warn', message, detail);
    if (isDev()) sink.warn(message, detail ?? '');
  },
  /**
   * خطاها در همهٔ حالت‌ها (حتی بیلد نهایی) یک خط در کنسول ثبت می‌شوند؛
   * بدون stack trace چیزی از داده‌های کاربر بیرون نمی‌رود.
   */
  error(message: string, detail?: unknown): void {
    record('error', message, detail);
    sink.error(message, serialize(detail) ?? '');
  },
  /** فهرست فعلی رکوردها (کپی فقط‌خواندنی) */
  getRecords(): readonly LogRecord[] {
    return [...buffer];
  },
  /** اشتراک در تغییرات (برای صفحهٔ لاگ در رابط)؛ تابع لغو برمی‌گرداند */
  subscribe(listener: (records: readonly LogRecord[]) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** پاک‌کردن بافر (دکمهٔ «پاک‌کردن لاگ» در صفحهٔ بیشتر) */
  clear(): void {
    buffer.length = 0;
    for (const listener of listeners) {
      try {
        listener(buffer);
      } catch {
        // نادیده می‌گیریم
      }
    }
  },
};
