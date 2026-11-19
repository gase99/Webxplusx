/**
 * A-Cut 2Dpro — هستهٔ مشترک موتور چیدمان
 * ======================================
 * کارهایی که همهٔ الگوریتم‌ها به آن‌ها نیاز دارند و نباید تکرار شوند:
 *  - گردکردن مختصات و ثابت‌های عددی
 *  - اعتبارسنجی ورودی (ابعاد ورق، تعداد قطعات، kerf، …)
 *  - بازکردن «تعداد» هر ردیف به نمونه‌های منفرد + کسر ضخامت نوار
 *  - ساخت `LayoutResult` کامل (خلاصه/متریک‌ها) از خروجی خام الگوریتم
 */
import { calculateCutDimensions } from '../types/part';
import type {
  LayoutOptions,
  LayoutPartInput,
  LayoutResult,
  PackingContext,
  PackingOutcome,
  PartInstance,
  PlacedPart,
  SheetLayout,
  StockSheet,
  UnplacedPart,
} from './types';
import { DEFAULT_ALGORITHM_ID } from '../config/constants';

export const EPS = 1e-9;

/** گردکردن تا ۲ رقم اعشار تا مختصات JSON/DXF تمیز بماند */
export const round2 = (n: number): number => Math.round(n * 100) / 100;

/** مستطیل آزاد روی یک صفحه (width روی X و height روی Y) */
export interface FreeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/* ------------------------------------------------------------------ */
/*  اعتبارسنجی ورودی                                                   */
/* ------------------------------------------------------------------ */

export interface ValidationIssue {
  /** کد ماشینی برای تست/منطق */
  code:
    | 'INVALID_STOCK'
    | 'INVALID_KERF'
    | 'INVALID_BAND_THICKNESS'
    | 'FRACTIONAL_QTY'
    | 'INVALID_QTY'
    | 'INVALID_PART_DIMENSIONS'
    | 'EMPTY_PART_DIMENSIONS'
    | 'NEGATIVE_DIMENSIONS'
    | 'PART_TOO_SMALL_AFTER_BAND'
    | 'INVALID_MAX_SHEETS';
  /** پیام فارسی مناسب نمایش به کاربر */
  message: string;
  /** شناسهٔ ردیف/قطعهٔ مربوط (در صورت وجود) */
  partId?: string;
}

export interface ValidationReport {
  ok: boolean;
  issues: ValidationIssue[];
}

export interface RawLayoutInput {
  parts: readonly LayoutPartInput[];
  stock: StockSheet;
  options?: Partial<LayoutOptions>;
}

const isPositiveFinite = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0;

/**
 * اعتبارسنجی کامل ورودی موتور چیدمان.
 * سیاست برنامه:
 *  - ابعاد ورق باید عدد مثبت و متناهی باشد (صفر/منفی/NaN ⇒ خطا، محاسبه انجام نمی‌شود).
 *  - تعداد قطعه باید عدد صحیح مثبت باشد؛ تعداد کسری هشدار می‌گیرد و در محاسبه
 *    به پایین (floor) گرد می‌شود — همان رفتار نسخه‌های قبلی.
 *  - ردیف‌های ناقص (طول/عرض صفر) نادیده گرفته می‌شوند ولی ابعاد منفی خطا هستند.
 */
export function validateLayoutInput(input: RawLayoutInput): ValidationReport {
  const issues: ValidationIssue[] = [];
  const { stock } = input;
  const options = input.options ?? {};

  if (!isPositiveFinite(stock?.length) || !isPositiveFinite(stock?.width)) {
    issues.push({
      code: 'INVALID_STOCK',
      message: 'ابعاد ورق خام (طول و عرض) باید عددی مثبت و بزرگ‌تر از صفر باشد.',
    });
  }

  const kerf = options.kerf ?? 0;
  if (typeof kerf !== 'number' || !Number.isFinite(kerf) || kerf < 0) {
    issues.push({
      code: 'INVALID_KERF',
      message: 'اندازهٔ تیغه (kerf) باید عددی مثبت یا صفر باشد.',
    });
  }

  const bandThickness = options.bandThickness ?? 0;
  if (typeof bandThickness !== 'number' || !Number.isFinite(bandThickness) || bandThickness < 0) {
    issues.push({
      code: 'INVALID_BAND_THICKNESS',
      message: 'ضخامت نوار/استریپ باید عددی مثبت یا صفر باشد.',
    });
  }

  const maxSheets = options.maxSheets ?? 0;
  if (typeof maxSheets !== 'number' || !Number.isFinite(maxSheets) || maxSheets < 0) {
    issues.push({
      code: 'INVALID_MAX_SHEETS',
      message: 'سقف تعداد ورق باید عددی مثبت یا صفر (بدون محدودیت) باشد.',
    });
  }

  for (const part of input.parts) {
    if (!Number.isFinite(part.length) || !Number.isFinite(part.width) || !Number.isFinite(part.qty)) {
      issues.push({
        code: 'INVALID_PART_DIMENSIONS',
        partId: part.id,
        message: `ردیف «${part.name?.trim() || 'بدون نام'}» مقدار عددی نامعتبر دارد.`,
      });
      continue;
    }
    if (part.length < 0 || part.width < 0) {
      issues.push({
        code: 'NEGATIVE_DIMENSIONS',
        partId: part.id,
        message: `ردیف «${part.name?.trim() || 'بدون نام'}» ابعاد منفی دارد و در محاسبه لحاظ نمی‌شود.`,
      });
      continue;
    }
    if (part.qty < 0) {
      issues.push({
        code: 'INVALID_QTY',
        partId: part.id,
        message: `تعداد ردیف «${part.name?.trim() || 'بدون نام'}» منفی است.`,
      });
      continue;
    }
    // ردیف‌های کاملاً خالی (۰ × ۰) فقط نادیده گرفته می‌شوند، خطا نیستند.
    if (part.length === 0 || part.width === 0) {
      if (part.length === 0 && part.width === 0) continue;
      issues.push({
        code: 'EMPTY_PART_DIMENSIONS',
        partId: part.id,
        message: `ردیف «${part.name?.trim() || 'بدون نام'}» فقط یک بُعد دارد و در محاسبه لحاظ نمی‌شود.`,
      });
      continue;
    }
    if (part.qty > 0 && !Number.isInteger(part.qty)) {
      issues.push({
        code: 'FRACTIONAL_QTY',
        partId: part.id,
        message: `تعداد ردیف «${part.name?.trim() || 'بدون نام'}» کسری است (${part.qty}) و به ${Math.floor(part.qty)} گرد می‌شود؛ لطفاً عدد صحیح وارد کنید.`,
      });
    }
    const cut = calculateCutDimensions(part, bandThickness);
    if (!(cut.length > 0) || !(cut.width > 0)) {
      issues.push({
        code: 'PART_TOO_SMALL_AFTER_BAND',
        partId: part.id,
        message: `پس از کسر ضخامت نوار/استریپ، ابعاد ردیف «${part.name?.trim() || 'بدون نام'}» صفر یا منفی می‌شود.`,
      });
    }
  }

  // خطاهای «مسدودکننده»: بدون آن‌ها اصلاً نمی‌توان محاسبه کرد.
  const blockingCodes: ValidationIssue['code'][] = [
    'INVALID_STOCK',
    'INVALID_KERF',
    'INVALID_BAND_THICKNESS',
    'INVALID_MAX_SHEETS',
    'INVALID_PART_DIMENSIONS',
    'INVALID_QTY',
    'NEGATIVE_DIMENSIONS',
  ];
  const ok = !issues.some((issue) => blockingCodes.includes(issue.code));
  return { ok, issues };
}

/** نسخهٔ ساده: آیا ورودی قابل محاسبه است؟ */
export function isValidLayoutInput(input: RawLayoutInput): boolean {
  return validateLayoutInput(input).ok;
}

/* ------------------------------------------------------------------ */
/*  آماده‌سازی نمونه‌های قطعه                                           */
/* ------------------------------------------------------------------ */

/**
 * بازکردن تعداد هر ردیف به نمونه‌های منفرد.
 * ابعاد هر نمونه از `calculateCutDimensions` می‌آید (منبع مشترک با جدول/Label/DXF)
 * تا ضخامت نوار فقط در یک نقطه کسر شود.
 */
export function expandInstances(
  parts: readonly LayoutPartInput[],
  bandThickness: number,
): PartInstance[] {
  const instances: PartInstance[] = [];
  let order = 0;
  for (const part of parts) {
    // ردیف‌های ناقص (ابعاد یا تعداد نامعتبر) نادیده گرفته می‌شوند
    if (!(part.length > 0 && part.width > 0 && part.qty > 0)) continue;
    const qty = Math.floor(part.qty);
    const { length: cutLength, width: cutWidth } = calculateCutDimensions(part, bandThickness);
    if (!(cutLength > 0) || !(cutWidth > 0) || !(qty > 0)) continue;
    for (let i = 1; i <= qty; i++) {
      instances.push({
        id: part.id,
        name: part.name,
        instanceIndex: i,
        length: cutLength,
        width: cutWidth,
        area: cutLength * cutWidth,
        maxDimension: Math.max(cutLength, cutWidth),
        originalOrder: order,
      });
    }
    order++;
  }
  return instances;
}

/** مرتب‌سازی استاندارد «بزرگ‌تر اول» (مساحت نزولی، بعد بزرگ‌ترین بُعد، بعد ترتیب ورود) */
export function sortInstancesByAreaDesc(instances: PartInstance[]): PartInstance[] {
  return [...instances].sort(
    (a, b) =>
      b.area - a.area ||
      b.maxDimension - a.maxDimension ||
      a.originalOrder - b.originalOrder,
  );
}

/* ------------------------------------------------------------------ */
/*  ابزارهای مستطیل                                                    */
/* ------------------------------------------------------------------ */

export function intersects(a: FreeRect, b: FreeRect): boolean {
  return (
    a.x < b.x + b.width - EPS &&
    a.x + a.width > b.x + EPS &&
    a.y < b.y + b.height - EPS &&
    a.y + a.height > b.y + EPS
  );
}

/** آیا مستطیل a کامل داخل b است؟ */
export function containsRect(outer: FreeRect, inner: FreeRect): boolean {
  return (
    inner.x >= outer.x - EPS &&
    inner.y >= outer.y - EPS &&
    inner.x + inner.width <= outer.x + outer.width + EPS &&
    inner.y + inner.height <= outer.y + outer.height + EPS
  );
}

/** حذف مستطیل‌هایی که کامل داخل مستطیل دیگری افتاده‌اند (بهبود O(n²) با مرتب‌سازی مساحت) */
export function pruneContained(rects: FreeRect[]): FreeRect[] {
  if (rects.length < 2) return rects;
  // مستطیل بزرگ‌تر نمی‌تواند داخل کوچک‌تر باشد ⇒ فقط یک‌بار روی لیست مرتب‌شده می‌گردیم
  const ordered = rects
    .map((rect, index) => ({ rect, index, area: rect.width * rect.height }))
    .sort((a, b) => b.area - a.area);
  const kept: FreeRect[] = [];
  for (const candidate of ordered) {
    if (!kept.some((other) => containsRect(other, candidate.rect))) {
      kept.push(candidate.rect);
    }
  }
  return kept;
}

/* ------------------------------------------------------------------ */
/*  جمع‌بندی: ساخت LayoutResult از خروجی خام                            */
/* ------------------------------------------------------------------ */

export interface FinalizeInput {
  context: PackingContext;
  outcome: PackingOutcome;
  startedAt: number;
  stock: StockSheet;
  kerf: number;
  bandThickness: number;
  sheetColor?: string;
  bandColor?: string;
}

/** محاسبهٔ معیارهای برش از روی جای‌گذاری‌ها (تخمین مستند) */
export function computeMetrics(
  placements: readonly PlacedPart[],
  stock: StockSheet,
): { cutLength: number; cutCount: number } {
  /**
   * تخمین طول خط برش: هر قطعه با (دست‌کم) دو برش مستقیم «عرض + ارتفاع» از
   * ورق جدا می‌شود، پس مجموع (width + height) کران پایین معقولی برای طول
   * برش است. تعداد برش = ۲ به‌ازای هر قطعه.
   */
  let cutLength = 0;
  let cutCount = 0;
  for (const placement of placements) {
    cutLength += placement.width + placement.height;
    cutCount += 2;
  }
  // برش دور ورق خام (۱ برش در هر لبهٔ مصرف‌شده) — فقط اگر ورقی مصرف شده باشد
  if (placements.length > 0) {
    cutLength += 2 * (stock.length + stock.width);
    cutCount += 4;
  }
  return { cutLength: Math.round(cutLength), cutCount };
}

/** ساخت `SheetLayout` با محاسبهٔ پرت/بهره‌وری هر ورق */
export function buildSheetLayout(
  sheetIndex: number,
  placements: PlacedPart[],
  stockArea: number,
): SheetLayout {
  const usedArea = placements.reduce((sum, p) => sum + p.width * p.height, 0);
  const wasteArea = Math.max(0, stockArea - usedArea);
  return {
    sheetIndex,
    placements,
    usedArea: round2(usedArea),
    wasteArea: round2(wasteArea),
    utilizationPercentage: stockArea > 0 ? round2((usedArea / stockArea) * 100) : 0,
    wastePercentage: stockArea > 0 ? round2((wasteArea / stockArea) * 100) : 0,
  };
}

/** ساخت نتیجهٔ نهایی مشترک همهٔ الگوریتم‌ها */
export function finalizeResult(input: FinalizeInput): LayoutResult {
  const { context, outcome, startedAt } = input;
  const { stock, kerf } = input;
  const stockArea = stock.length > 0 && stock.width > 0 ? stock.length * stock.width : 0;

  const sheets: SheetLayout[] = outcome.sheets.map((sheet, index) =>
    buildSheetLayout(index, sheet.placements, stockArea),
  );
  const placements = sheets.flatMap((sheet) => sheet.placements);
  const usedArea = sheets.reduce((sum, sheet) => sum + sheet.usedArea, 0);
  const totalSheetArea = sheets.length * stockArea;
  const wasteArea = Math.max(0, totalSheetArea - usedArea);
  const unplaced: UnplacedPart[] = outcome.unplaced;
  const metrics = computeMetrics(placements, stock);

  return {
    stock,
    kerf,
    bandThickness: input.bandThickness,
    allowRotation: context.allowRotation,
    sheetColor: input.sheetColor,
    bandColor: input.bandColor,
    algorithm: context.selection.id,
    variant: context.selection.variant,
    sheets,
    placements,
    unplaced,
    summary: {
      sheetCount: sheets.length,
      totalParts: context.instances.length,
      placedCount: placements.length,
      unplacedCount: unplaced.length,
      stockAreaPerSheet: round2(stockArea),
      totalSheetArea: round2(totalSheetArea),
      usedArea: round2(usedArea),
      wasteArea: round2(wasteArea),
      utilizationPercentage: totalSheetArea > 0 ? round2((usedArea / totalSheetArea) * 100) : 0,
      wastePercentage: totalSheetArea > 0 ? round2((wasteArea / totalSheetArea) * 100) : 0,
    },
    metrics: {
      ...metrics,
      elapsedMs: Math.max(0, Math.round(performance.now() - startedAt)),
      algorithm: context.selection.id,
      variant: context.selection.variant,
    },
    maxSheets: context.maxSheets,
  };
}

/** الگوریتم پیش‌فرض (برای سازگاری با پروژه‌های قدیمی) */
export const LEGACY_ALGORITHM_ID = DEFAULT_ALGORITHM_ID;

/**
 * آیا این نمونه در هیچ جهتی داخل یک ورق خالی جا می‌شود؟
 * (مبنای تشخیص دلیل «جا نشدن»: بزرگ‌تر از ورق یا اتمام موجودی ورق)
 */
export function fitsInStock(
  instance: { length: number; width: number },
  stock: StockSheet,
  allowRotation: boolean,
): boolean {
  const asIs = instance.length <= stock.length + EPS && instance.width <= stock.width + EPS;
  if (asIs) return true;
  return (
    allowRotation &&
    instance.length <= stock.width + EPS &&
    instance.width <= stock.length + EPS
  );
}
