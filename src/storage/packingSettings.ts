/**
 * A-Cut 2Dpro — ذخیره‌سازی تنظیمات موتور چیدمان (انتخاب الگوریتم)
 * =============================================================
 * انتخاب الگوریتم و گزینه‌هایش باید بین رفرش‌ها و بین صفحات پایدار بماند.
 * این تنظیمات جزو «پروژه» نیستند (پروژه = قطعات + تنظیمات ورق)، بلکه
 * ترجیح کاربر است؛ پس در `localStorage` نگه داشته می‌شوند تا حتی با بازکردن
 * یک پروژهٔ دیگر هم حفظ شوند.
 */
import { STORAGE_KEYS } from '../config/constants';
import { logger } from '../lib/logger';
import type { AlgorithmSelection } from '../engine/types';
import { DEFAULT_SELECTION, normalizeSelection } from '../engine/registry';
import { DEFAULT_MAX_SHEETS, DEFAULT_OPTIMIZER_ITERATIONS, DEFAULT_OPTIMIZER_SEED } from '../config/constants';

export interface PackingSettings {
  /** الگوریتم فعال و زیرگزینه‌اش */
  selection: AlgorithmSelection;
  /** سقف ورق (۰ = نامحدود) */
  maxSheets: number;
  /** اجرای خودکار محاسبه بعد از تغییر ورودی‌ها (با debounce) */
  autoRecalculate: boolean;
}

export const DEFAULT_PACKING_SETTINGS: PackingSettings = {
  selection: {
    ...DEFAULT_SELECTION,
    iterations: DEFAULT_OPTIMIZER_ITERATIONS,
    seed: DEFAULT_OPTIMIZER_SEED,
  },
  maxSheets: DEFAULT_MAX_SHEETS,
  autoRecalculate: false,
};

/** خواندن تنظیمات ذخیره‌شده با پاک‌سازی مقادیر نامعتبر */
export function loadPackingSettings(): PackingSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.packingSettings);
    if (!raw) return DEFAULT_PACKING_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PackingSettings>;
    return {
      selection: normalizeSelection(parsed.selection),
      maxSheets:
        typeof parsed.maxSheets === 'number' && Number.isFinite(parsed.maxSheets)
          ? Math.max(0, Math.floor(parsed.maxSheets))
          : DEFAULT_MAX_SHEETS,
      autoRecalculate: parsed.autoRecalculate === true,
    };
  } catch (error) {
    logger.warn('خواندن تنظیمات چیدمان ناموفق بود؛ پیش‌فرض اعمال شد', error);
    return DEFAULT_PACKING_SETTINGS;
  }
}

/** ذخیرهٔ تنظیمات (خطای حافظه نباید برنامه را متوقف کند) */
export function savePackingSettings(settings: PackingSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.packingSettings, JSON.stringify(settings));
  } catch (error) {
    logger.warn('ذخیرهٔ تنظیمات چیدمان ناموفق بود', error);
  }
}
