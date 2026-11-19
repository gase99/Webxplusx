/**
 * A-Cut 2Dpro — خلاصهٔ آماری لیست قطعات
 * =====================================
 * یک‌جا محاسبه می‌شود تا داشبورد، صفحهٔ قطعات و برگهٔ کنترل تولید همه یک عدد
 * ببینند (مساحت برش با کسر ضخامت نوار، متراژ نوار/شیار و تعداد لبهٔ فارسی).
 */
import { calculateCutDimensions, isEmptyPart, isValidPart, type CutPart } from '../types/part';

export interface PartsStats {
  /** ردیف‌های کامل (طول، عرض، تعداد) */
  rowCount: number;
  /** مجموع تعداد قطعات */
  totalQty: number;
  /** مساحت برش پس از کسر ضخامت نوار (مترمربع) */
  totalAreaM2: number;
  /** متراژ نوار لبه (متر) */
  bandMeters: number;
  /** متراژ شیار (متر) */
  grooveMeters: number;
  /** تعداد لبه‌های فارسی */
  farsiEdges: number;
  /** ردیف‌های ناقص (نام/ابعاد کامل نشده) */
  incomplete: number;
  /** ردیف‌های با تعداد کسری (هشدار) */
  fractional: number;
  /** ردیف‌های با ابعاد منفی/نامعتبر */
  invalid: number;
}

export function computePartsStats(parts: readonly CutPart[], bandThickness: number): PartsStats {
  const valid = parts.filter(isValidPart);
  const totalQty = valid.reduce((sum, part) => sum + part.qty, 0);
  const totalAreaM2 =
    valid.reduce((sum, part) => {
      const cut = calculateCutDimensions(part, bandThickness);
      return sum + Math.max(0, cut.length) * Math.max(0, cut.width) * part.qty;
    }, 0) / 1_000_000;

  const bandMeters =
    valid.reduce(
      (sum, part) => sum + part.qty * (Number(part.bandLength) * part.length + Number(part.bandWidth) * part.width),
      0,
    ) / 1000;

  const grooveMeters =
    valid.reduce(
      (sum, part) => sum + part.qty * (Number(part.grooveLength) * part.length + Number(part.grooveWidth) * part.width),
      0,
    ) / 1000;

  const farsiEdges = valid.reduce(
    (sum, part) => sum + part.qty * (Number(part.farsiLength) + Number(part.farsiWidth)),
    0,
  );

  return {
    rowCount: valid.length,
    totalQty,
    totalAreaM2,
    bandMeters,
    grooveMeters,
    farsiEdges,
    incomplete: parts.filter((part) => !isEmptyPart(part) && !isValidPart(part)).length,
    fractional: parts.filter((part) => isValidPart(part) && !Number.isInteger(part.qty)).length,
    invalid: parts.filter(
      (part) => !Number.isFinite(part.length) || !Number.isFinite(part.width) || part.length < 0 || part.width < 0,
    ).length,
  };
}
