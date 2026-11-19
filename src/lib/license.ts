/**
 * A-Cut 2Dpro — لایسنس آفلاین و قفل برنامه
 * ==========================================
 * مدل: بعد از ذخیرهٔ `FREE_PROJECT_LIMIT` پروژه، برنامه قفل می‌شود و فقط با
 * لایسنس معتبر باز می‌شود. لایسنس یک توکن امضاشده است:
 *
 *   base64url(payload_json) + "." + base64url(signature)
 *
 * - payload: { v, id, device, iat, exp } — شناسهٔ دستگاه، زمان صدور و انقضا
 *   (exp=null یعنی مادام‌العمر).
 * - signature: امضای ECDSA P-256 روی بایت‌های خام JSON، با کلید خصوصی‌ای که
 *   فقط روی سرور ربات تلگرام است. برنامه با کلید عمومیِ داخل خودش
 *   (LICENSE_PUBLIC_KEY_JWK) اعتبارسنجی می‌کند — کاملاً آفلاین، بدون سرور.
 *
 * شناسهٔ دستگاه در localStorage ساخته و نگه داشته می‌شود؛ کاربر آن را در
 * صفحهٔ قفل می‌بیند و برای صدور لایسنس به ربات تلگرام می‌دهد.
 */

import { LICENSE_PUBLIC_KEY_JWK, STORAGE_KEYS } from '../config/constants';
import { logger } from './logger';

/** محتوای رمزگشایی‌شدهٔ لایسنس */
export interface LicensePayload {
  /** نسخهٔ فرمت */
  v: number;
  /** شناسهٔ یکتای لایسنس */
  id: string;
  /** شناسهٔ دستگاهی که لایسنس برای آن صادر شده */
  device: string;
  /** زمان صدور (ثانیهٔ یونیکس) */
  iat: number;
  /** زمان انقضا (ثانیهٔ یونیکس) یا null برای مادام‌العمر */
  exp: number | null;
}

export type LicenseCheckReason =
  | 'ok'
  | 'missing'
  | 'malformed'
  | 'bad_signature'
  | 'device_mismatch'
  | 'expired';

export interface LicenseCheckResult {
  valid: boolean;
  reason: LicenseCheckReason;
  payload?: LicensePayload;
}

/* ---------------- base64url ---------------- */

function base64UrlToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* ---------------- شناسهٔ دستگاه ---------------- */

/** شناسهٔ یکتای این نصب — ساخته می‌شود و در localStorage می‌ماند. */
export function getDeviceId(): string {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEYS.deviceId);
    if (existing) return existing;
    const created =
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    window.localStorage.setItem(STORAGE_KEYS.deviceId, created);
    return created;
  } catch {
    // localStorage در دسترس نیست (حالت خصوصی/محدود) — شناسهٔ موقت برمی‌گردانیم
    logger.warn('localStorage در دسترس نیست؛ شناسهٔ دستگاه موقت ساخته شد');
    return `dev-temp-${Date.now().toString(36)}`;
  }
}

/* ---------------- تجزیه و اعتبارسنجی ---------------- */

/** تجزیهٔ رشتهٔ لایسنس به payload و امضا — بدون اعتبارسنجی امضا. */
export function parseLicense(key: string): { payload: LicensePayload; payloadBytes: Uint8Array; signature: Uint8Array } | null {
  const parts = key.trim().split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  try {
    const payloadBytes = base64UrlToBytes(parts[0]);
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as LicensePayload;
    if (
      typeof payload !== 'object' ||
      payload === null ||
      payload.v !== 1 || typeof payload.id !== 'string' ||
      typeof payload.device !== 'string' ||
      !Number.isFinite(payload.iat) ||
      !(payload.exp === null || (typeof payload.exp === 'number' && Number.isFinite(payload.exp)))
    ) {
      return null;
    }
    const signature = base64UrlToBytes(parts[1]);
    if (signature.length !== 64) return null; // امضای خام P-256 همیشه ۶۴ بایت است
    return { payload, payloadBytes, signature };
  } catch {
    return null;
  }
}

/**
 * اعتبارسنجی امضای ECDSA با کلید عمومی داده‌شده (برای تست‌پذیری، کلید قابل
 * تزریق است؛ در عمل کلید عمومیِ ثابت برنامه استفاده می‌شود).
 */
export async function verifyLicenseSignature(
  payloadBytes: Uint8Array,
  signature: Uint8Array,
  publicKeyJwk: JsonWebKey = LICENSE_PUBLIC_KEY_JWK as unknown as JsonWebKey,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'jwk',
      publicKeyJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      signature as BufferSource,
      payloadBytes as BufferSource,
    );
  } catch (error) {
    logger.warn('اعتبارسنجی امضای لایسنس ناموفق بود', error);
    return false;
  }
}

/**
 * بررسی کامل یک لایسنس برای دستگاه جاری: ساختار، امضا، تطابق دستگاه و انقضا.
 * `publicKeyJwk` فقط برای تست تزریق می‌شود.
 */
export async function checkLicense(
  key: string | null | undefined,
  deviceId: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  publicKeyJwk?: JsonWebKey,
): Promise<LicenseCheckResult> {
  if (!key) return { valid: false, reason: 'missing' };
  const parsed = parseLicense(key);
  if (!parsed) return { valid: false, reason: 'malformed' };
  const signatureOk = await verifyLicenseSignature(parsed.payloadBytes, parsed.signature, publicKeyJwk);
  if (!signatureOk) return { valid: false, reason: 'bad_signature' };
  if (parsed.payload.device !== deviceId) return { valid: false, reason: 'device_mismatch' };
  if (parsed.payload.exp !== null && parsed.payload.exp <= nowSeconds) {
    return { valid: false, reason: 'expired', payload: parsed.payload };
  }
  return { valid: true, reason: 'ok', payload: parsed.payload };
}

/* ---------------- ذخیره‌سازی و وضعیت قفل ---------------- */

/** لایسنس ذخیره‌شدهٔ فعلی (اگر باشد) */
export function getStoredLicense(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEYS.license);
  } catch {
    return null;
  }
}

/**
 * تلاش برای فعال‌سازی لایسنس واردشده: فقط اگر برای همین دستگاه معتبر باشد
 * ذخیره می‌شود. نتیجهٔ بررسی برگردانده می‌شود تا رابط پیام مناسب نشان دهد.
 */
export async function activateLicense(key: string): Promise<LicenseCheckResult> {
  const result = await checkLicense(key, getDeviceId());
  if (result.valid) {
    try {
      window.localStorage.setItem(STORAGE_KEYS.license, key.trim());
    } catch (error) {
      logger.warn('ذخیرهٔ لایسنس ناموفق بود', error);
    }
  }
  return result;
}

/** آیا سقف پروژه‌های رایگان رد شده است؟ (پرچم ماندگار — با حذف پروژه برنمی‌گردد) */
export function isLimitReached(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEYS.limitReached) === '1';
  } catch {
    return false;
  }
}

/** ثبت اینکه سقف پروژه رد شده است — یک‌بار برای همیشه */
export function markLimitReached(): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.limitReached, '1');
  } catch {
    // نادیده می‌گیریم
  }
}

/**
 * وضعیت نهایی قفل: اگر سقف رد نشده باشد آزاد است؛ وگرنه فقط لایسنس معتبر
 * برای همین دستگاه آن را باز می‌کند.
 */
export async function isAppLocked(): Promise<boolean> {
  if (!isLimitReached()) return false;
  const result = await checkLicense(getStoredLicense(), getDeviceId());
  return !result.valid;
}

/** برای تست/بازسازی: ساخت رشتهٔ لایسنس از payload (امضا با کلید خصوصی داده‌شده) */
export async function signLicenseForTest(
  payload: LicensePayload,
  privateKey: CryptoKey,
): Promise<string> {
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, payloadBytes),
  );
  return `${bytesToBase64Url(payloadBytes)}.${bytesToBase64Url(signature)}`;
}

/** Unique project IDs ever saved; deleting a project never refunds its trial use. */
export function recordTrialProjects(ids: string[]): number {
  const key = 'acut_trial_projects';
  const previous: unknown = JSON.parse(localStorage.getItem(key) || '[]');
  if (!Array.isArray(previous) || !previous.every(id => typeof id === 'string')) throw new Error('Invalid trial record');
  const all = [...new Set([...previous, ...ids])];
  localStorage.setItem(key, JSON.stringify(all));
  return all.length;
}
