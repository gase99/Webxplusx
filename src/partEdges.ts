/**
 * A-Cut 2Dpro — نگاشت مشترک «لبه‌های قطعه» (منبع واحد برای نقشه، DXF و لیبل)
 * ---------------------------------------------------------------------
 * فلگ‌های «طول» در مدل داده یعنی دو لبهٔ موازی با محور طول قطعه و فلگ‌های
 * «عرض» یعنی دو لبهٔ موازی با محور عرض آن. وقتی قطعه روی ورق ۹۰ درجه
 * می‌چرخد (`isRotated`)، محور طولش عمودی می‌شود و این نگاشت جابه‌جا می‌شود.
 * هر سه خروجی فاز ۳/۴ (SVG نقشه، فایل DXF و لیبل‌ها) باید دقیقاً از همین
 * تابع استفاده کنند تا علامت‌ها هرگز روی لبهٔ اشتباه نیفتند.
 *
 * نام لبه‌ها نسبت به دستگاه مختصات چیدمان است: مبدأ (0,0) گوشهٔ ورق،
 * لبهٔ «top» همان لبه‌ای است که y آن کمینه است و «bottom» لبهٔ با y بیشینه.
 *
 * نسخه نهایی: مقادیر ۰/۱/۲ — ۰ بدون، ۱ یک لبه، ۲ هر دو لبه
 */
import type { CutPart, EdgeCount } from './types/part';

export type PartSide = 'top' | 'bottom' | 'left' | 'right';

export type EdgeFlags = Pick<
  CutPart,
  | 'bandLength'
  | 'bandWidth'
  | 'farsiLength'
  | 'farsiWidth'
  | 'grooveLength'
  | 'grooveWidth'
>;

export interface PartEdgeSides {
  band: PartSide[];
  farsi: PartSide[];
  groove: PartSide[];
}

/**
 * لبه‌های متناظر یک جفت ورودی عددی (۰/۱/۲) روی قطعهٔ رسم‌شده.
 * بدون چرخش: طول افقی است ⇒ لبه‌های طول = بالا/پایین، عرض = چپ/راست.
 * با چرخش ۹۰ درجه برعکس می‌شود.
 * برای مقدار ۱: فقط یک لبه (بالا برای طول، چپ برای عرض) رسم می‌شود.
 * برای مقدار ۲: هر دو لبهٔ مقابل.
 */
export function sidesForFlags(
  lengthCount: EdgeCount | number | boolean,
  widthCount: EdgeCount | number | boolean,
  isRotated: boolean,
): PartSide[] {
  const sides: PartSide[] = [];
  // نرمال‌سازی: boolean قدیمی و عدد
  const lc = typeof lengthCount === 'boolean' ? (lengthCount ? 2 : 0) : Number(lengthCount) || 0;
  const wc = typeof widthCount === 'boolean' ? (widthCount ? 2 : 0) : Number(widthCount) || 0;

  if (lc >= 2) {
    sides.push(...(isRotated ? (['left', 'right'] as PartSide[]) : (['top', 'bottom'] as PartSide[])));
  } else if (lc === 1) {
    sides.push(isRotated ? 'left' : 'top');
  }
  if (wc >= 2) {
    sides.push(...(isRotated ? (['top', 'bottom'] as PartSide[]) : (['left', 'right'] as PartSide[])));
  } else if (wc === 1) {
    sides.push(isRotated ? 'top' : 'left');
  }
  return sides;
}

/** لبه‌های هر سه عملیات کارگاهی (نوار/فارسی/شیار) برای یک قطعهٔ چیده‌شده */
export function getPartEdgeSides(part: EdgeFlags, isRotated: boolean): PartEdgeSides {
  return {
    band: sidesForFlags(part.bandLength, part.bandWidth, isRotated),
    farsi: sidesForFlags(part.farsiLength, part.farsiWidth, isRotated),
    groove: sidesForFlags(part.grooveLength, part.grooveWidth, isRotated),
  };
}

/** فاصلهٔ خط شیار از لبهٔ قطعه (میلی‌متر) — در نقشه، DXF و لیبل یکسان است */
export const GROOVE_INSET_MM = 10;

/** فاصلهٔ انتهای خط شیار از گوشه‌های قطعه (میلی‌متر) — خط شیار تا لبه نمی‌رسد */
export const GROOVE_END_GAP_MM = 10;
