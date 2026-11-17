/**
 * A-Cut 2Dpro — تنظیمات ظاهری (تم، نوار بالا، رنگ تأکید، انیمیشن)
 * ----------------------------------------------------------------
 * این تنظیمات جدا از «تنظیمات پروژه» (ورق، تیغه، نوار) هستند و روی
 * ظاهر کل برنامه اثر می‌گذارند؛ روی <html> به‌صورت data-attribute اعمال
 * می‌شوند تا همهٔ استایل‌ها در CSS مرکزی بمانند و در localStorage نگه
 * داشته می‌شوند. اسکریپت کوچک داخل index.html هم همین مقادیر را قبل از
 * اولین رنگ‌آمیزی صفحه اعمال می‌کند تا هیچ پرشی دیده نشود.
 */

export type AccentId = 'ocean' | 'violet' | 'emerald' | 'rose' | 'amber' | 'graphite';
export type HeaderStyle = 'glass' | 'solid' | 'gradient' | 'minimal';
export type CornerStyle = 'soft' | 'round' | 'sharp';
export type MotionLevel = 'full' | 'soft' | 'off';

export interface UiPrefs {
  /** پالت رنگ تأکید کل برنامه */
  accent: AccentId;
  /** ظاهر نوار بالای صفحه */
  header: HeaderStyle;
  /** میزان گردی گوشه‌ها */
  corners: CornerStyle;
  /** سطح انیمیشن‌ها (هایلایت چرخان، ترنزیشن‌ها) */
  motion: MotionLevel;
  /** هایلایت رنگی چرخان دور دکمه‌های اصلی */
  ring: boolean;
}

export const UI_PREFS_KEY = 'acut_ui_prefs';

export const DEFAULT_UI_PREFS: UiPrefs = {
  accent: 'ocean',
  header: 'glass',
  corners: 'soft',
  motion: 'full',
  ring: true,
};

export const ACCENT_OPTIONS: {
  id: AccentId;
  label: string;
  /** دو رنگ برای نمایش دکمهٔ انتخاب (حالت روشن و تاریک) */
  swatch: [string, string];
}[] = [
  { id: 'ocean', label: 'اقیانوسی', swatch: ['#0e7490', '#22d3ee'] },
  { id: 'violet', label: 'بنفش', swatch: ['#6d28d9', '#a78bfa'] },
  { id: 'emerald', label: 'زمردی', swatch: ['#047857', '#34d399'] },
  { id: 'rose', label: 'شقایقی', swatch: ['#be123c', '#fb7185'] },
  { id: 'amber', label: 'کهربایی', swatch: ['#b45309', '#fbbf24'] },
  { id: 'graphite', label: 'گرافیتی', swatch: ['#334155', '#94a3b8'] },
];

export const HEADER_OPTIONS: { id: HeaderStyle; label: string; hint: string }[] = [
  { id: 'glass', label: 'شیشه‌ای', hint: 'نیمه‌شفاف با بلور پس‌زمینه' },
  { id: 'solid', label: 'یکدست', hint: 'نوار رنگی توپر با رنگ تأکید' },
  { id: 'gradient', label: 'گرادیانی', hint: 'طیف دو رنگ تأکید' },
  { id: 'minimal', label: 'ساده', hint: 'بدون پس‌زمینه، فقط خط جداکننده' },
];

export const CORNER_OPTIONS: { id: CornerStyle; label: string; hint: string }[] = [
  { id: 'soft', label: 'نرم', hint: 'گوشه‌های متعادل (پیش‌فرض)' },
  { id: 'round', label: 'گرد', hint: 'گوشه‌های کاملاً گرد' },
  { id: 'sharp', label: 'تیز', hint: 'گوشه‌های کم‌شعاع' },
];

export const MOTION_OPTIONS: { id: MotionLevel; label: string; hint: string }[] = [
  { id: 'full', label: 'کامل', hint: 'هایلایت چرخان و ترنزیشن‌ها' },
  { id: 'soft', label: 'ملایم', hint: 'حرکت کندتر و بدون پرش' },
  { id: 'off', label: 'خاموش', hint: 'بدون انیمیشن (سریع‌ترین)' },
];

const ACCENT_IDS: AccentId[] = ACCENT_OPTIONS.map((option) => option.id);
const HEADER_IDS: HeaderStyle[] = HEADER_OPTIONS.map((option) => option.id);
const CORNER_IDS: CornerStyle[] = CORNER_OPTIONS.map((option) => option.id);
const MOTION_IDS: MotionLevel[] = MOTION_OPTIONS.map((option) => option.id);

/** خواندن امن تنظیمات ظاهری از localStorage (هر مقدار نامعتبر ← پیش‌فرض) */
export function loadUiPrefs(): UiPrefs {
  try {
    const raw = localStorage.getItem(UI_PREFS_KEY);
    if (!raw) return { ...DEFAULT_UI_PREFS };
    const parsed = JSON.parse(raw) as Partial<UiPrefs> | null;
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_UI_PREFS };
    return {
      accent: ACCENT_IDS.includes(parsed.accent as AccentId)
        ? (parsed.accent as AccentId)
        : DEFAULT_UI_PREFS.accent,
      header: HEADER_IDS.includes(parsed.header as HeaderStyle)
        ? (parsed.header as HeaderStyle)
        : DEFAULT_UI_PREFS.header,
      corners: CORNER_IDS.includes(parsed.corners as CornerStyle)
        ? (parsed.corners as CornerStyle)
        : DEFAULT_UI_PREFS.corners,
      motion: MOTION_IDS.includes(parsed.motion as MotionLevel)
        ? (parsed.motion as MotionLevel)
        : DEFAULT_UI_PREFS.motion,
      ring: typeof parsed.ring === 'boolean' ? parsed.ring : DEFAULT_UI_PREFS.ring,
    };
  } catch {
    return { ...DEFAULT_UI_PREFS };
  }
}

/** اعمال تنظیمات روی <html> — همهٔ استایل‌ها از همین data-attribute‌ها می‌آیند */
export function applyUiPrefs(prefs: UiPrefs): void {
  const root = document.documentElement;
  root.dataset.accent = prefs.accent;
  root.dataset.header = prefs.header;
  root.dataset.corners = prefs.corners;
  root.dataset.motion = prefs.motion;
  root.dataset.ring = prefs.ring ? 'on' : 'off';
}

/** ذخیرهٔ تنظیمات ظاهری (بی‌صدا در صورت نبود localStorage) */
export function saveUiPrefs(prefs: UiPrefs): void {
  try {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // حالت خصوصی مرورگر — تنظیمات فقط برای همین اجرا اعمال می‌شود
  }
}
