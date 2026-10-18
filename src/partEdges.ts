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
 */
import type { CutPart } from './types/part';

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
 * لبه‌های متناظر یک جفت فلگ (طول/عرض) روی قطعهٔ رسم‌شده.
 * بدون چرخش: طول افقی است ⇒ لبه‌های طول = بالا/پایین، عرض = چپ/راست.
 * با چرخش ۹۰ درجه برعکس می‌شود.
 */
export function sidesForFlags(
  lengthFlag: boolean,
  widthFlag: boolean,
  isRotated: boolean,
): PartSide[] {
  const sides: PartSide[] = [];
  if (lengthFlag) {
    sides.push(...(isRotated ? (['left', 'right'] as PartSide[]) : (['top', 'bottom'] as PartSide[])));
  }
  if (widthFlag) {
    sides.push(...(isRotated ? (['top', 'bottom'] as PartSide[]) : (['left', 'right'] as PartSide[])));
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
