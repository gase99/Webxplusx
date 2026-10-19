/**
 * A-Cut 2Dpro — پیش‌نویس فضای کاری روی localStorage
 * --------------------------------------------------------
 * - فهرست پروژه‌ها از این فایل به دیتابیس IndexedDB منتقل شده
 *   است (src/db/database.ts — با Dexie و توابع CRUD ناهمگام).
 * - پیش‌نویس فضای کاری فعلی: کلید `acut_draft` — به‌صورت خودکار
 *   ذخیره می‌شود تا رفرش صفحه کار در حال انجام را از بین نبرد
 *   (مستقل از «ذخیرهٔ پروژه» که عمل صریح کاربر است و مبنای
 *   تشخیص تغییرات ذخیره‌نشده قرار می‌گیرد).
 * - مهاجرت: اگر از فازهای قبلی فقط قطعات ذخیره شده باشد (کلید
 *   قدیمی)، همان قطعات به‌عنوان پیش‌نویس اولیه خوانده می‌شوند.
 */
import { createSampleParts, migratePart, type CutPart } from '../types/part';
import {
  DEFAULT_LAYOUT_SETTINGS,
  UNTITLED_PROJECT_NAME,
  computeWorkspaceSignature,
  type LayoutSettings,
  type LayoutState,
} from '../types/project';

export const DRAFT_STORAGE_KEY = 'acut_draft';
const LEGACY_PARTS_KEY = 'a-cut-2dpro:parts:v1';

export interface WorkspaceDraft {
  projectId: string | null;
  projectName: string;
  parts: CutPart[];
  settings: LayoutSettings;
  layoutState: LayoutState | null;
  /** امضای آخرین وضعیت ذخیره‌شدهٔ پروژه (مبنای تشخیص Dirty بعد از رفرش) */
  baselineSignature: string;
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** ساخت پیش‌نویس پیش‌فرض از روی یک لیست قطعه */
function draftFromParts(parts: CutPart[]): WorkspaceDraft {
  const settings = { ...DEFAULT_LAYOUT_SETTINGS };
  return {
    projectId: null,
    projectName: UNTITLED_PROJECT_NAME,
    parts,
    settings,
    layoutState: null,
    baselineSignature: computeWorkspaceSignature(parts, settings, UNTITLED_PROJECT_NAME),
  };
}

/**
 * بارگذاری فضای کاری هنگام شروع برنامه:
 * پیش‌نویس خودکار ← قطعات ذخیره‌شدهٔ فازهای قبلی ← دادهٔ نمونه
 */
export function loadWorkspaceDraft(): WorkspaceDraft {
  try {
    const draft = safeParse<WorkspaceDraft>(localStorage.getItem(DRAFT_STORAGE_KEY));
    if (draft && Array.isArray(draft.parts) && draft.parts.length > 0 && draft.settings) {
      const settings = { ...DEFAULT_LAYOUT_SETTINGS, ...draft.settings };
      const projectName = draft.projectName || UNTITLED_PROJECT_NAME;
      const migrated = (draft.parts as unknown[]).map((raw) => migratePart(raw));
      const migratedLayout = draft.layoutState ? {
        ...draft.layoutState,
        partsSnapshot: (draft.layoutState.partsSnapshot as unknown[]).map((raw) => migratePart(raw)),
      } : null;
      return {
        projectId: draft.projectId ?? null,
        projectName,
        parts: migrated,
        settings,
        layoutState: migratedLayout as typeof draft.layoutState,
        baselineSignature:
          draft.baselineSignature ??
          computeWorkspaceSignature(migrated, settings, projectName),
      };
    }

    const legacyParts = safeParse<CutPart[]>(localStorage.getItem(LEGACY_PARTS_KEY));
    if (Array.isArray(legacyParts) && legacyParts.length > 0) {
      return draftFromParts(legacyParts);
    }
  } catch {
    // فضای ذخیره‌سازی در دسترس نیست؛ با دادهٔ نمونه شروع می‌کنیم
  }
  return draftFromParts(createSampleParts());
}

export function saveWorkspaceDraft(draft: WorkspaceDraft): void {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // بدون ذخیرهٔ خودکار ادامه می‌دهیم
  }
}
