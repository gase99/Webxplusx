/**
 * A-Cut 2Dpro — مدل دادهٔ قطعه (Part)
 * -----------------------------------
 * تعاریف تخصصی:
 *  - «نوار»  (band)  : لبه‌چسب / نوار PVC (Edge Banding)
 *  - «فارسی»  (farsi)  : برش زاویهٔ ۴۵ درجه (Miter Cut)
 *  - «شیار»  (groove): شیار برای جاگذاری ورق ۳ میلی‌متری (پشت‌بند)
 *
 * قرارداد فاز ۳ (نمایش نقشهٔ برش):
 *  اگر `farsiLength` یا `farsiWidth` برابر true بود، آن لبهٔ قطعه روی نقشهٔ برش
 *  باید با خط قرمز + هاشور مورب و برچسب «۴۵°» رندر شود تا اپراتور متوجه برش
 *  فارسی شود. (پیاده‌سازی مرجع این قاعده در PartPreview.tsx انجام شده است.)
 *
 * واحد طول و عرض: میلی‌متر (mm)
 * قرارداد جهت‌ها: `*Length` یعنی دو لبهٔ موازی با جهت طول (لبه‌های بالا و پایین
 * وقتی طول افقی رسم شود) و `*Width` یعنی دو لبهٔ موازی با جهت عرض (چپ و راست).
 */
export interface CutPart {
  id: string;
  name: string; // نام قطعه
  length: number; // طول (mm)
  width: number; // عرض (mm)
  qty: number; // تعداد
  bandLength: boolean; // نوار در طول
  bandWidth: boolean; // نوار در عرض
  farsiLength: boolean; // برش ۴۵ درجه در طول (نیاز به علامت بصری در نقشه)
  farsiWidth: boolean; // برش ۴۵ درجه در عرض (نیاز به علامت بصری در نقشه)
  grooveLength: boolean; // شیار در طول
  grooveWidth: boolean; // شیار در عرض
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
    bandLength: false,
    bandWidth: false,
    farsiLength: false,
    farsiWidth: false,
    grooveLength: false,
    grooveWidth: false,
    ...overrides,
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
      bandLength: true,
      grooveLength: true,
    }),
    createPart({
      name: 'درب کابینت',
      length: 715,
      width: 396,
      qty: 4,
      bandLength: true,
      bandWidth: true,
      farsiLength: true,
    }),
    createPart({
      name: 'طبقه',
      length: 564,
      width: 520,
      qty: 3,
      bandLength: true,
    }),
    createPart({
      name: 'سقف و کف',
      length: 564,
      width: 560,
      qty: 2,
      bandLength: true,
      grooveWidth: true,
    }),
    createPart(), // ردیف خالی آمادهٔ ورود اطلاعات بعدی
  ];
}
