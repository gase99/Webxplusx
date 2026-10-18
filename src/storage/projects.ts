/**
 * A-Cut 2Dpro — لایهٔ ذخیره‌سازی پروژه‌ها روی localStorage
 * ---------------------------------------------------------
 * - فهرست پروژه‌های ذخیره‌شده: کلید `acut_projects` (آرایه‌ای از Project)
 * - پیش‌نویس فضای کاری فعلی: کلید `acut_draft` — به‌صورت خودکار ذخیره می‌شود
 *   تا رفرش صفحه کار در حال انجام را از بین نبرد (مستقل از «ذخیرهٔ پروژه» که
 *   عمل صریح کاربر است و مبنای تشخیص تغییرات ذخیره‌نشده قرار می‌گیرد).
 * - مهاجرت: اگر از فازهای قبلی فقط قطعات ذخیره شده باشد (کلید قدیمی)، همان
 *   قطعات به‌عنوان پیش‌نویس اولیه خوانده می‌شوند.
 */
import { createSampleParts, type CutPart } from '../types/part';
import {
  DEFAULT_LAYOUT_SETTINGS,
  UNTITLED_PROJECT_NAME,
  computeWorkspaceSignature,
  type LayoutSettings,
  type LayoutState,
  type Project,
} from '../types/project';

export const PROJECTS_STORAGE_KEY = 'acut_projects';
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

/** خواندن فهرست پروژه‌های ذخیره‌شده (آیتم‌های خراب نادیده گرفته می‌شوند) */
export function loadProjects(): Project[] {
  try {
    const parsed = safeParse<unknown[]>(localStorage.getItem(PROJECTS_STORAGE_KEY));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isProjectLike).map((p) => ({
      ...p,
      settings: { ...DEFAULT_LAYOUT_SETTINGS, ...p.settings },
      createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
      updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : Date.now(),
    }));
  } catch {
    return [];
  }
}

/** ذخیرهٔ فهرست پروژه‌ها؛ در صورت پرشدن حافظه false برمی‌گرداند */
export function saveProjects(projects: Project[]): boolean {
  try {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
    return true;
  } catch {
    return false;
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
      return {
        projectId: draft.projectId ?? null,
        projectName,
        parts: draft.parts,
        settings,
        layoutState: draft.layoutState ?? null,
        baselineSignature:
          draft.baselineSignature ??
          computeWorkspaceSignature(draft.parts, settings, projectName),
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
