/**
 * A-Cut 2Dpro — مدل پروژه (فاز ۵: مدیریت پروژه‌ها)
 * ------------------------------------------------
 * یک پروژه موجودیت مستقلی است شامل: قطعات، تنظیمات ورق/تیغه و (اختیاری)
 * آخرین نتیجهٔ چیدمان تا هنگام بازکردن پروژه نیازی به محاسبهٔ مجدد نباشد
 * و نقشهٔ برش بلافاصله رندر شود.
 */
import type { LayoutResult } from '../algorithm';
import { createPartId, isValidPart, type CutPart } from './part';

/** تنظیمات چیدمان که همراه پروژه ذخیره می‌شود */
export interface LayoutSettings {
  stockLength: number; // طول صفحهٔ خام (mm)
  stockWidth: number; // عرض صفحهٔ خام (mm)
  kerf: number; // ضخامت تیغهٔ اره (mm)
  allowRotation: boolean; // چرخش ۹۰ درجهٔ قطعات مجاز است؟
}

export const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  stockLength: 3660,
  stockWidth: 1830,
  kerf: 4,
  allowRotation: true,
};

export const UNTITLED_PROJECT_NAME = 'پروژهٔ بدون نام';

export interface Project {
  id: string;
  name: string;
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
  parts: CutPart[];
  settings: LayoutSettings;
  /**
   * آخرین نتیجهٔ محاسبهٔ چیدمان (اختیاری) تا هنگام بازکردن پروژه، نقشهٔ
   * برش بدون محاسبهٔ مجدد بلافاصله نمایش داده شود.
   */
  lastLayout?: LayoutResult;
  /**
   * اسنپ‌شات قطعات در لحظهٔ همان محاسبه؛ فلگ‌های نوار/فارسی/شیار نقشه از
   * روی این اسنپ‌شات خوانده می‌شوند (نه از قطعات فعلی که شاید بعداً ویرایش شده‌اند).
   */
  lastLayoutParts?: CutPart[];
}

/** وضعیت نتیجهٔ چیدمان در فضای کاری جاری (نتیجه + اسنپ‌شات + امضای ورودی‌ها) */
export interface LayoutState {
  result: LayoutResult;
  partsSnapshot: CutPart[];
  /** امضای ورودی‌هایی که این نتیجه از آن‌ها ساخته شده (برای تشخیص «نتیجهٔ قدیمی») */
  signature: string;
}

export function createProjectId(): string {
  return createPartId();
}

export function cloneParts(parts: CutPart[]): CutPart[] {
  return parts.map((p) => ({ ...p }));
}

/**
 * امضای ورودی‌های مؤثر بر چیدمان (قطعات معتبر + تنظیمات) — برای تشخیص
 * قدیمی‌شدن نتیجه بعد از ویرایش. در LayoutPanel و هنگام بازکردن پروژه
 * هر دو از همین تابع استفاده می‌شود تا مقایسه همیشه هم‌معنا باشد.
 */
export function computeLayoutSignature(parts: CutPart[], settings: LayoutSettings): string {
  return JSON.stringify({
    parts: parts.filter(isValidPart).map((p) => [p.id, p.length, p.width, p.qty]),
    stockLength: settings.stockLength,
    stockWidth: settings.stockWidth,
    kerf: settings.kerf,
    allowRotation: settings.allowRotation,
  });
}

/**
 * امضای کل فضای کاری برای تشخیص «تغییرات ذخیره‌نشده» (Dirty):
 * همهٔ فیلدهای قطعات (از جمله نام و فلگ‌ها) + تنظیمات + نام پروژه.
 */
export function computeWorkspaceSignature(
  parts: CutPart[],
  settings: LayoutSettings,
  projectName: string,
): string {
  return JSON.stringify({
    name: projectName,
    settings,
    parts: parts.map((p) => [
      p.id,
      p.name,
      p.length,
      p.width,
      p.qty,
      p.bandLength,
      p.bandWidth,
      p.farsiLength,
      p.farsiWidth,
      p.grooveLength,
      p.grooveWidth,
    ]),
  });
}

/** تنظیماتی که یک نتیجهٔ چیدمان عملاً با آن‌ها محاسبه شده (از خود نتیجه) */
export function settingsFromLayout(result: LayoutResult): LayoutSettings {
  return {
    stockLength: result.stock.length,
    stockWidth: result.stock.width,
    kerf: result.kerf,
    allowRotation: result.allowRotation,
  };
}
