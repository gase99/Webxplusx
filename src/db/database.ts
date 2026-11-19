/**
 * A-Cut 2Dpro — دیتابیس محلی پروژه‌ها (IndexedDB با Dexie)
 * --------------------------------------------------------
 * - دیتابیس: `acut-2dpro-db` / جدول `projects` (کلید اصلی: id)
 * - پیش‌نویس فضای کاری (acut_draft) همچنان در localStorage می‌ماند
 *   چون فایل موقت و پرکاربرد است و باید همگام نوشته شود.
 *
 * مدیریت خطا (فاز پایداری):
 *  همهٔ عملیات CRUD خطای خام IndexedDB را به `DbError` با پیام فارسی تبدیل
 *  می‌کنند؛ بنابراین رابط کاربری می‌تواند علتِ دقیق (پرِ حافظه، قفل‌شدن،
 *  ناسازگاری نسخه یا نبود دسترسی) را نشان دهد و در صورت لزوم «تلاش دوباره»
 *  پیشنهاد کند. هیچ خطایی بی‌صدا بلعیده نمی‌شود.
 */
import Dexie, { type Table } from 'dexie';
import { migratePart } from '../types/part';
import { logger } from '../lib/logger';
import { DEFAULT_LAYOUT_SETTINGS, type Project } from '../types/project';
import { DbError, guardDb } from './errors';

export { DbError, classifyDbError, DB_ERROR_MESSAGES, type DbErrorKind } from './errors';

const DB_NAME = 'acut-2dpro-db';
/** کلید قدیمی فهرست پروژه‌ها در localStorage (فاز ۵ و پیش‌تر) */
export const LEGACY_PROJECTS_STORAGE_KEY = 'acut_projects';

export class AcutDatabase extends Dexie {
  projects!: Table<Project, string>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      projects: 'id, updatedAt',
    });
    // اگر دیتابیس توسط تب دیگری قفل شود (ارتقای نسخه)، کاربر باید بداند
    this.on('blocked', () => {
      logger.warn('دیتابیس پروژه‌ها توسط تب دیگری قفل شد');
    });
    this.on('versionchange', () => {
      logger.warn('نسخهٔ دیتابیس پروژه‌ها تغییر کرد؛ نیاز به بارگذاری مجدد صفحه');
      this.close();
    });
  }
}

/** نمونهٔ واحد دیتابیس برای کل اپلیکیشن */
export const db = new AcutDatabase();

/** آیا IndexedDB در این محیط در دسترس است؟ */
export function isDatabaseSupported(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

/* ================= توابع CRUD ناهمگام ================= */

/**
 * فهرست همهٔ پروژه‌ها، جدیدترین اول.
 * در صورت خرابی رکوردها، آرایهٔ خالی برنمی‌گردانیم تا کاربر فکر نکند داده‌اش
 * از بین رفته؛ خطا با `DbError` بالا می‌رود.
 */
export async function listProjects(): Promise<Project[]> {
  return guardDb('خواندن فهرست پروژه‌ها', async () => {
    const all = await db.projects.toArray();
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  });
}

/** خواندن یک پروژه بر اساس شناسه */
export async function getProject(id: string): Promise<Project | undefined> {
  return guardDb('خواندن پروژه', () => db.projects.get(id));
}

/** ذخیره (افزودن یا به‌روزرسانی) یک پروژه */
export async function putProject(project: Project): Promise<string> {
  if (!project?.id) {
    throw new DbError('UNKNOWN', 'پروژه شناسه ندارد و ذخیره نشد');
  }
  return guardDb('ذخیرهٔ پروژه', () => db.projects.put(project));
}

/** حذف یک پروژه بر اساس شناسه */
export async function deleteProject(id: string): Promise<void> {
  return guardDb('حذف پروژه', () => db.projects.delete(id));
}

/** ذخیرهٔ گروهی (برای مهاجرت/واردکردن پشتیبان) */
export async function bulkPutProjects(projects: Project[]): Promise<void> {
  return guardDb('ذخیرهٔ گروهی پروژه‌ها', async () => {
    await db.projects.bulkPut(projects);
  });
}

/** تعداد پروژه‌های ذخیره‌شده */
export async function countProjects(): Promise<number> {
  return guardDb('شمارش پروژه‌ها', () => db.projects.count());
}

/**
 * برآورد فضای مصرف‌شده (در صورت پشتیبانی مرورگر).
 * برای هشدار «حافظه در حال پر شدن» در صفحهٔ تنظیمات پیشرفته.
 */
export async function estimateStorage(): Promise<{ usage: number; quota: number } | null> {
  try {
    if (!navigator.storage?.estimate) return null;
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota };
  } catch {
    return null;
  }
}

/* ============ مهاجرت داده‌های قدیمی localStorage ============ */

function isProjectLike(value: unknown): value is Project {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Partial<Project>;
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    Array.isArray(p.parts) &&
    typeof p.settings === 'object' &&
    p.settings !== null
  );
}

/** نرمال‌سازی پروژهٔ مهاجرت‌شده (قطعات و تنظیمات به‌روزرسانی می‌شوند) */
function normalizeProject(raw: Project): Project {
  const migratedParts = (raw.parts as unknown[]).map((p) => migratePart(p));
  const migratedLayoutParts = (raw.lastLayoutParts as unknown[] | undefined)?.map(
    (p) => migratePart(p),
  );
  return {
    ...raw,
    parts: migratedParts,
    lastLayoutParts: migratedLayoutParts as typeof raw.lastLayoutParts,
    settings: { ...DEFAULT_LAYOUT_SETTINGS, ...raw.settings },
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
  } as Project;
}

/**
 * مهاجرت یک‌باره: پروژه‌های ذخیره‌شده در localStorage (کلید
 * acut_projects) را به IndexedDB منتقل می‌کند و کلید قدیمی را
 * حذف می‌کند. تعداد پروژه‌های مهاجرت‌شده را برمی‌گرداند.
 *
 * نکته: کلید قدیمی فقط بعد از موفقیت نوشتن در دیتابیس حذف می‌شود تا اگر
 * مهاجرت شکست خورد، داده از دست نرود (باگ پاک‌شدنِ پیش از ذخیره).
 */
export async function migrateLegacyProjects(): Promise<number> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LEGACY_PROJECTS_STORAGE_KEY);
  } catch {
    return 0; // localStorage در دسترس نیست (مثلاً حالت خصوصی)
  }
  if (!raw) return 0;

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  if (!Array.isArray(parsed)) {
    // دادهٔ خراب: کلید را نگه می‌داریم تا کاربر بتواند دستی بررسی کند
    logger.warn('دادهٔ قدیمی پروژه‌ها قابل خواندن نبود و منتقل نشد');
    return 0;
  }

  const projects = parsed.filter(isProjectLike).map(normalizeProject);
  if (projects.length > 0) {
    try {
      await bulkPutProjects(projects);
    } catch (error) {
      // مهاجرت ناموفق ⇒ کلید قدیمی باقی می‌ماند و دفعهٔ بعد دوباره تلاش می‌شود
      logger.warn('مهاجرت پروژه‌های قدیمی ناموفق بود', error);
      return 0;
    }
  }
  try {
    localStorage.removeItem(LEGACY_PROJECTS_STORAGE_KEY);
  } catch {
    // نادیده می‌گیریم
  }
  return projects.length;
}
