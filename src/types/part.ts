/**
 * A-Cut 2Dpro — مدل دادهٔ قطعه (Part) — نسخه نهایی با ورودی عددی ۰/۱/۲
 * --------------------------------------------------------------------
 * تعاریف تخصصی:
 *  - «نوار»  (band)  : لبه‌چسب / نوار PVC (Edge Banding)
 *  - «فارسی»  (farsi)  : برش زاویهٔ ۴۵ درجه (Miter Cut)
 *  - «شیار»  (groove): شیار برای جاگذاری ورق ۳ میلی‌متری (پشت‌بند)
 *
 * نسخه نهایی: هر عملیات لبه‌ به‌صورت عدد صحیح ۰/۱/۲ ذخیره می‌شود:
 *   ۰ = بدون عملیات روی آن محور
 *   ۱ = فقط یک لبه از دو لبهٔ مقابل (مثلاً فقط یک طول)
 *   ۲ = هر دو لبهٔ مقابل (معادل تیک قدیمیِ boolean:true)
 * این مدل با داده‌های قدیمی (boolean) سازگار است و هنگام بارگذاری
 * به‌صورت خودکار مهاجرت می‌کند.
 *
 * قرارداد جهت‌ها: `*Length` یعنی دو لبهٔ موازی با جهت طول (لبه‌های بالا و پایین
 * وقتی طول افقی رسم شود) و `*Width` یعنی دو لبهٔ موازی با جهت عرض (چپ و راست).
 */

export type EdgeCount = 0 | 1 | 2;

/** نرمال‌سازی مقدار ورودی (سازگاری با داده قدیمی boolean) به ۰/۱/۲ */
export function normalizeEdgeCount(value: unknown): EdgeCount {
  if (value === true) return 2;
  if (value === false) return 0;
  if (typeof value === 'number') {
    if (value >= 2) return 2;
    if (value >= 1) return 1;
    return 0;
  }
  if (typeof value === 'string') {
    const n = parseInt(value, 10);
    if (Number.isFinite(n)) return normalizeEdgeCount(n);
  }
  return 0;
}

export interface CutPart {
  id: string;
  name: string; // نام قطعه
  length: number; // طول (mm)
  width: number; // عرض (mm)
  qty: number; // تعداد
  bandLength: EdgeCount; // نوار در طول: ۰/۱/۲
  bandWidth: EdgeCount; // نوار در عرض: ۰/۱/۲
  farsiLength: EdgeCount; // برش ۴۵ درجه در طول: ۰/۱/۲
  farsiWidth: EdgeCount; // برش ۴۵ درجه در عرض: ۰/۱/۲
  grooveLength: EdgeCount; // شیار در طول: ۰/۱/۲
  grooveWidth: EdgeCount; // شیار در عرض: ۰/۱/۲
}

/** فیلدهایی که با کیبورد (Enter) بین آن‌ها جابه‌جا می‌شویم */
export type EditableField = 'name' | 'length' | 'width' | 'qty';

export type FlagField =
  | 'bandLength'
  | 'bandWidth'
  | 'farsiLength'
  | 'farsiWidth'
  | 'grooveLength'
  | 'grooveWidth';

/** ساخت شناسهٔ یکتا برای ردیف قطعه */
export function createPartId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `part-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createPart(overrides: Partial<CutPart> = {}): CutPart {
  return {
    id: createPartId(),
    name: '',
    length: 0,
    width: 0,
    qty: 1,
    bandLength: 0,
    bandWidth: 0,
    farsiLength: 0,
    farsiWidth: 0,
    grooveLength: 0,
    grooveWidth: 0,
    ...overrides,
  };
}

/** مهاجرت یک قطعهٔ قدیمی (boolean) به مدل عددی ۰/۱/۲ */
export function migratePart(raw: unknown): CutPart {
  const p = raw as Record<string, unknown>;
  return {
    id: typeof p.id === 'string' ? p.id : createPartId(),
    name: typeof p.name === 'string' ? p.name : '',
    length: typeof p.length === 'number' ? p.length : 0,
    width: typeof p.width === 'number' ? p.width : 0,
    qty: typeof p.qty === 'number' ? p.qty : 1,
    bandLength: normalizeEdgeCount(p.bandLength),
    bandWidth: normalizeEdgeCount(p.bandWidth),
    farsiLength: normalizeEdgeCount(p.farsiLength),
    farsiWidth: normalizeEdgeCount(p.farsiWidth),
    grooveLength: normalizeEdgeCount(p.grooveLength),
    grooveWidth: normalizeEdgeCount(p.grooveWidth),
  };
}

/** ردیف خالی است؟ (نام و ابعاد خالی و هیچ گزینه‌ای فعال نیست) */
export function isEmptyPart(p: CutPart): boolean {
  return (
    p.name.trim() === '' &&
    !p.length &&
    !p.width &&
    !p.bandLength &&
    !p.bandWidth &&
    !p.farsiLength &&
    !p.farsiWidth &&
    !p.grooveLength &&
    !p.grooveWidth
  );
}

/** ردیف از نظر ابعاد کامل و قابل‌استفاده در محاسبات است؟ */
export function isValidPart(p: CutPart): boolean {
  return p.length > 0 && p.width > 0 && p.qty > 0;
}

/** دادهٔ نمونه برای نمایش و تست سریع جدول */
export function createSampleParts(): CutPart[] {
  return [
    createPart({
      name: 'بدنه کناری',
      length: 720,
      width: 560,
      qty: 2,
      bandLength: 2,
      grooveLength: 1,
    }),
    createPart({
      name: 'درب کابینت',
      length: 715,
      width: 396,
      qty: 4,
      bandLength: 2,
      bandWidth: 2,
      farsiLength: 2,
    }),
    createPart({
      name: 'طبقه',
      length: 564,
      width: 520,
      qty: 3,
      bandLength: 1,
    }),
    createPart({
      name: 'سقف و کف',
      length: 564,
      width: 560,
      qty: 2,
      bandLength: 2,
      grooveWidth: 1,
    }),
    createPart(), // ردیف خالی آمادهٔ ورود اطلاعات بعدی
  ];
}
