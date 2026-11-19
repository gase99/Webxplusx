/**
 * ابزارهای مشترک تست موتور چیدمان
 * ================================
 * «بررسی‌کنندهٔ ناوَریانت» (invariant checker) روی خروجی همهٔ الگوریتم‌ها اجرا
 * می‌شود تا مطمئن شویم:
 *   ۱) هر قطعه کامل داخل ورق است (within bounds)
 *   ۲) هیچ دو قطعه‌ای روی هم نمی‌افتند (no overlap)
 *   ۳) همهٔ قطعات یا چیده شده‌اند یا در فهرست «جا نشد» آمده‌اند
 *   ۴) شمارش‌ها و مساحت‌های خلاصه با جای‌گذاری‌های واقعی هم‌خوان است
 *   ۵) قطعات چیده‌شده در صفحهٔ درست خودشان هستند و فاصلهٔ تیغه حفظ شده است
 */
import { expect } from 'vitest';
import type { LayoutResult, PlacedPart } from '../types';
import type { LayoutPartInput } from '../types';

const EPS = 0.01; // مختصات تا ۲ رقم اعشار گرد می‌شوند

export interface InvariantOptions {
  /** kerf مورد انتظار (برای بررسی فاصلهٔ بین قطعات). پیش‌فرض از نتیجه خوانده می‌شود. */
  kerf?: number;
  /** آیا انتظار داریم همهٔ قطعات چیده شوند؟ */
  expectAllPlaced?: boolean;
  /** بررسی فاصلهٔ تیغه (در صورت شکست الگوریتم‌ها را سخت‌گیر نکنیم) */
  checkKerf?: boolean;
}

function overlaps(a: PlacedPart, b: PlacedPart): boolean {
  return (
    a.x < b.x + b.width - EPS &&
    a.x + a.width > b.x + EPS &&
    a.y < b.y + b.height - EPS &&
    a.y + a.height > b.y + EPS
  );
}

/** فاصلهٔ افقی/عمودی دو قطعهٔ همسایه؛ صفر یعنی چسبیده */
function gapBetween(a: PlacedPart, b: PlacedPart): { dx: number; dy: number } {
  const dx = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width), 0);
  const dy = Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height), 0);
  return { dx, dy };
}

/**
 * بررسی کامل ناوَریانت‌ها. در صورت نقض، تست با پیام روشن شکست می‌خورد.
 */
export function checkInvariants(result: LayoutResult, options: InvariantOptions = {}): void {
  const { stock } = result;
  const kerf = options.kerf ?? result.kerf ?? 0;

  expect(stock.length).toBeGreaterThan(0);
  expect(stock.width).toBeGreaterThan(0);

  for (const sheet of result.sheets) {
    for (const p of sheet.placements) {
      // ۱) داخل مرزهای ورق
      expect(p.x, `x منفی در قطعه ${p.id}`).toBeGreaterThanOrEqual(-EPS);
      expect(p.y, `y منفی در قطعه ${p.id}`).toBeGreaterThanOrEqual(-EPS);
      expect(p.x + p.width, `خروج از عرض ورق در قطعه ${p.id}`).toBeLessThanOrEqual(stock.length + EPS);
      expect(p.y + p.height, `خروج از ارتفاع ورق در قطعه ${p.id}`).toBeLessThanOrEqual(stock.width + EPS);
      expect(p.width).toBeGreaterThan(0);
      expect(p.height).toBeGreaterThan(0);
      // هر جای‌گذاری باید در صفحهٔ خودش ثبت شده باشد
      expect(p.sheetIndex).toBe(sheet.sheetIndex);
    }

    // ۲) بدون هم‌پوشانی (و در صورت درخواست، فاصلهٔ تیغه)
    for (let i = 0; i < sheet.placements.length; i++) {
      for (let j = i + 1; j < sheet.placements.length; j++) {
        const a = sheet.placements[i];
        const b = sheet.placements[j];
        expect(overlaps(a, b), `هم‌پوشانی ${a.id}#${a.instanceIndex} با ${b.id}#${b.instanceIndex}`).toBe(false);
        if (options.checkKerf && kerf > 0) {
          const { dx, dy } = gapBetween(a, b);
          // اگر هم‌پوشانی در یک محور ندارند، فاصلهٔ آن محور باید دست‌کم kerf باشد
          const separatedX = a.x + a.width <= b.x + EPS || b.x + b.width <= a.x + EPS;
          const separatedY = a.y + a.height <= b.y + EPS || b.y + b.height <= a.y + EPS;
          if (separatedX && separatedY) {
            expect(Math.max(dx, dy), `فاصلهٔ تیغه رعایت نشده بین ${a.id} و ${b.id}`).toBeGreaterThanOrEqual(
              Math.min(kerf, 1) - EPS,
            );
          }
        }
      }
    }

    // ۴) مساحت‌های خلاصهٔ هر ورق با جای‌گذاری‌ها هم‌خوان باشد
    const used = sheet.placements.reduce((sum, p) => sum + p.width * p.height, 0);
    expect(sheet.usedArea).toBeCloseTo(used, 1);
    expect(sheet.usedArea + sheet.wasteArea).toBeCloseTo(stock.length * stock.width, 0);
    expect(sheet.utilizationPercentage).toBeGreaterThanOrEqual(0);
    expect(sheet.utilizationPercentage).toBeLessThanOrEqual(100);
  }

  // ۳) همهٔ قطعات یا چیده شده‌اند یا گزارش شده‌اند
  expect(result.summary.placedCount).toBe(result.placements.length);
  expect(result.summary.sheetCount).toBe(result.sheets.length);
  expect(result.summary.placedCount + result.summary.unplacedCount).toBe(result.summary.totalParts);
  if (options.expectAllPlaced) {
    expect(result.summary.unplacedCount, 'قطعهٔ جا‌نشده نباید وجود داشته باشد').toBe(0);
  }

  // هیچ صفحهٔ خالی نباید در نتیجه باشد
  for (const sheet of result.sheets) {
    expect(sheet.placements.length).toBeGreaterThan(0);
  }

  // ۵) خلاصهٔ کل
  const totalSheetArea = result.sheets.length * stock.length * stock.width;
  expect(result.summary.totalSheetArea).toBeCloseTo(totalSheetArea, 0);
  expect(result.summary.usedArea + result.summary.wasteArea).toBeCloseTo(totalSheetArea, 0);
  expect(result.summary.wastePercentage + result.summary.utilizationPercentage).toBeCloseTo(100, 1);
}

/** ساخت قطعهٔ ورودی با مقادیر پیش‌فرض تمیز */
export function part(overrides: Partial<LayoutPartInput> & { id: string }): LayoutPartInput {
  return { length: 100, width: 100, qty: 1, ...overrides };
}

/** دادهٔ ثابت برای تست‌های مقایسه/رگرسیون */
export function benchmarkDataset(): LayoutPartInput[] {
  const raw = [
    [720, 560, 2],
    [715, 396, 4],
    [564, 520, 3],
    [564, 560, 2],
    [400, 300, 6],
    [1200, 600, 2],
    [250, 250, 8],
    [900, 450, 1],
    [300, 1800, 1], // بلندتر از عرض ورق — فقط با چرخش جا می‌شود
    [1800, 300, 1],
    [450, 450, 5],
    [50, 50, 10],
  ] as const;
  return raw.map(([length, width, qty], index) => ({
    id: `bench-${index}`,
    name: `قطعهٔ ${index + 1}`,
    length,
    width,
    qty,
  }));
}
