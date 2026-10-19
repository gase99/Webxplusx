/**
 * A-Cut 2Dpro — دیتابیس محلی پروژه‌ها (IndexedDB با Dexie)
 * --------------------------------------------------------
 * فاز ۶: جایگزینی localStorage برای ذخیرهٔ پروژه‌ها با
 * IndexedDB — گنجایش بسیار بیشتر، همهٔ عملیات ناهمگام (Async)
 * و مهاجرت خودکار داده‌های قدیمی localStorage در نخستین اجرا.
 *
 * - دیتابیس: `acut-2dpro-db` / جدول `projects` (کلید اصلی: id)
 * - پیش‌نویس فضای کاری (acut_draft) همچنان در localStorage می‌ماند
 *   چون فایل موقت و پرکاربرد است و باید همگام نوشته شود.
 */
import Dexie, { type Table } from 'dexie';
import { migratePart } from '../types/part';
import {
  DEFAULT_LAYOUT_SETTINGS,
  type Project,
} from '../types/project';

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
  }
}

/** نمونهٔ واحد دیتابیس برای کل اپلیکیشن */
export const db = new AcutDatabase();

/* ================= توابع CRUD ناهمگام ================= */

/** فهرست همهٔ پروژه‌ها، جدیدترین اول */
export async function listProjects(): Promise<Project[]> {
  const all = await db.projects.toArray();
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** خواندن یک پروژه بر اساس شناسه */
export function getProject(id: string): Promise<Project | undefined> {
  return db.projects.get(id);
}

/** ذخیره (افزودن یا به‌روزرسانی) یک پروژه */
export function putProject(project: Project): Promise<string> {
  return db.projects.put(project);
}

/** حذف یک پروژه بر اساس شناسه */
export function deleteProject(id: string): Promise<void> {
  return db.projects.delete(id);
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
  try {
    localStorage.removeItem(LEGACY_PROJECTS_STORAGE_KEY);
  } catch {
    // نادیده می‌گیریم
  }
  if (!Array.isArray(parsed)) return 0;

  const projects = parsed.filter(isProjectLike).map(normalizeProject);
  if (projects.length > 0) {
    await db.projects.bulkPut(projects);
  }
  return projects.length;
}
