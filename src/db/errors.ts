/**
 * A-Cut 2Dpro — خطاهای دیتابیس و پیام‌های کاربرپسند
 * =================================================
 * IndexedDB می‌تواند به دلایل مختلفی شکست بخورد. کاربر کارگاه باید بداند
 * «چه شد» و «چه کار کند»، نه یک پیام انگلیسی یا سکوت. اینجاست که کد خطای
 * خام (Dexie/DOMException) به نوع مشخص و پیام فارسی تبدیل می‌شود.
 */

export type DbErrorKind =
  | 'QUOTA_EXCEEDED' // حافظهٔ مرورگر پر شده
  | 'BLOCKED' // تب/نسخهٔ دیگری دیتابیس را قفل کرده
  | 'VERSION_CONFLICT' // نسخهٔ دیتابیس ناسازگار است
  | 'UNAVAILABLE' // IndexedDB در دسترس نیست (حالت خصوصی/غیرفعال)
  | 'NOT_FOUND' // پروژه پیدا نشد
  | 'UNKNOWN';

export class DbError extends Error {
  constructor(
    readonly kind: DbErrorKind,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'DbError';
  }

  /** پیام فارسی مناسب نمایش در رابط کاربری */
  get userMessage(): string {
    return DB_ERROR_MESSAGES[this.kind];
  }

  /** آیا تلاش دوباره منطقی است؟ */
  get retryable(): boolean {
    return this.kind === 'BLOCKED' || this.kind === 'UNKNOWN';
  }
}

export const DB_ERROR_MESSAGES: Record<DbErrorKind, string> = {
  QUOTA_EXCEEDED:
    'حافظهٔ مرورگر پر شده است. چند پروژهٔ قدیمی را حذف کنید و دوباره تلاش کنید (یا از پروژه‌ها نسخهٔ پشتیبان بگیرید و مرورگر را پاک‌سازی کنید).',
  BLOCKED:
    'دیتابیس پروژه‌ها توسط تب یا پنجرهٔ دیگری قفل شده است. همهٔ تب‌های باز برنامه را ببندید و دوباره تلاش کنید.',
  VERSION_CONFLICT:
    'نسخهٔ دیتابیس با نسخهٔ فعلی برنامه هم‌خوان نیست. صفحه را یک‌بار کامل ببندید و دوباره باز کنید؛ اگر رفع نشد، داده‌های سایت را در تنظیمات مرورگر بازنشانی کنید.',
  UNAVAILABLE:
    'دیتابیس محلی مرورگر در دسترس نیست (مثلاً حالت خصوصی/ناشناس). برنامه کار می‌کند ولی ذخیرهٔ پروژه‌ها ممکن نیست؛ پیش‌نویس خودکار فعال است.',
  NOT_FOUND: 'این پروژه پیدا نشد؛ ممکن است در تب دیگری حذف شده باشد.',
  UNKNOWN: 'ذخیره‌سازی در مرورگر ناموفق بود. چند لحظه بعد دوباره تلاش کنید.',
};

/** تشخیص نوع خطا از نام/کد خطای DOM/IndexedDB/Dexie */
export function classifyDbError(error: unknown): DbError {
  if (error instanceof DbError) return error;

  const name = (error as { name?: string } | null)?.name ?? '';
  const message = (error as { message?: string } | null)?.message ?? String(error ?? '');
  const haystack = `${name} ${message}`.toLowerCase();

  let kind: DbErrorKind = 'UNKNOWN';
  if (haystack.includes('quota') || haystack.includes('exceeded')) kind = 'QUOTA_EXCEEDED';
  else if (haystack.includes('blocked')) kind = 'BLOCKED';
  else if (haystack.includes('versionerror') || haystack.includes('version error') || haystack.includes('upgrade'))
    kind = 'VERSION_CONFLICT';
  else if (
    haystack.includes('invalidstate') ||
    haystack.includes('notsupported') ||
    haystack.includes('security') ||
    haystack.includes('dataclone') ||
    haystack.includes('missing api') ||
    haystack.includes('indexeddb')
  )
    kind = 'UNAVAILABLE';
  else if (haystack.includes('notfound') || haystack.includes('not found')) kind = 'NOT_FOUND';

  const detail = name ? `${name}: ${message}` : message;
  return new DbError(kind, detail || 'خطای نامشخص دیتابیس', error);
}

/**
 * اجرای یک عملیات دیتابیس با تبدیل خطای خام به `DbError`.
 * همهٔ توابع CRUD از همین پوشش استفاده می‌کنند.
 */
export async function guardDb<T>(action: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const dbError = classifyDbError(error);
    // پیام فنی برای عیب‌یابی نگه داشته می‌شود ولی به کاربر نمایش داده نمی‌شود
    throw new DbError(dbError.kind, `${action}: ${dbError.message}`, error);
  }
}
