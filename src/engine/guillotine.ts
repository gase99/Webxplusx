/**
 * A-Cut 2Dpro — الگوریتم گیلوتینی (Guillotine Bin Packing)
 * ========================================================
 * نسخهٔ اصلی و پیش‌فرض برنامه. رفتار پیش‌فرض (variant = 'best-area-fit')
 * دقیقاً همان الگوریتم نسخه‌های قبلی است تا نقشهٔ برش پروژه‌های قدیمی
 * تغییر نکند؛ بقیهٔ گزینه‌ها فقط هیوریستیک انتخاب/تقسیم را عوض می‌کنند.
 *
 * چرا گیلوتینی؟
 *  در کارگاه واقعی، ارهٔ پانل‌بُر فقط برش مستقیم از یک لبه تا لبهٔ مقابل می‌زند.
 *  این الگوریتم فضای آزاد هر صفحه را به‌صورت مستطیل‌هایی نگه می‌دارد که با هر
 *  جایگذاری، با یک برش گیلوتینی (سرتاسری) به دو مستطیل کوچک‌تر تقسیم می‌شوند؛
 *  پس هر چیدمانی که تولید می‌کند عملاً با اره قابل‌اجراست.
 *
 * مدل ضخامت تیغه (Kerf):
 *  تیغه از سمت باقی‌مانده (پرت) خورده می‌شود، نه از خود قطعه. پس فضای اشغال‌شده
 *  از مستطیل آزاد = ابعاد قطعه + kerf در هر جهتی که بعد از قطعه فضا می‌ماند.
 *
 * هیوریستیک‌ها (قابل انتخاب):
 *  - `best-area-fit`           : کمترین مساحت باقی‌مانده، در تساوی کوتاه‌ترین ضلع (پیش‌فرض)
 *  - `best-short-side-fit`     : کوتاه‌ترین ضلع باقی‌مانده
 *  - `shorter-leftover-axis`   : اولویت انتخاب مستطیل با ضلع باقی‌ماندهٔ کوتاه‌تر + تقسیم همان محور
 *  - `longer-leftover-axis`    : تقسیم گیلوتینی در محور باقی‌ماندهٔ بزرگ‌تر (SplitLongerLeftoverAxis)
 */
import {
  EPS,
  fitsInStock,
  pruneContained,
  round2,
  sortInstancesByAreaDesc,
  type FreeRect,
} from './shared';
import type {
  AlgorithmVariant,
  PackingAlgorithm,
  PackingContext,
  PackingOutcome,
  PartInstance,
  PlacedPart,
} from './types';

/** نوع قانون تقسیم مستطیل آزاد */
type SplitRule = 'shorter-leftover-axis' | 'longer-leftover-axis';

interface WorkingSheet {
  sheetIndex: number;
  freeRects: FreeRect[];
  placements: PlacedPart[];
  usedArea: number;
}

interface PlacementCandidate {
  sheet: WorkingSheet;
  freeRectIndex: number;
  /** ابعاد قطعه در جهت انتخاب‌شده: w روی X و h روی Y */
  w: number;
  h: number;
  isRotated: boolean;
  areaLeftover: number;
  shortSideLeftover: number;
  longSideLeftover: number;
}

/** نقشهٔ هر گزینه به (هیوریستیک انتخاب، قانون تقسیم) */
const VARIANT_RULES: Record<
  'shorter-leftover-axis' | 'longer-leftover-axis' | 'best-short-side-fit' | 'best-area-fit',
  { select: 'area' | 'short-side'; split: SplitRule }
> = {
  'best-area-fit': { select: 'area', split: 'shorter-leftover-axis' },
  'best-short-side-fit': { select: 'short-side', split: 'shorter-leftover-axis' },
  'shorter-leftover-axis': { select: 'short-side', split: 'shorter-leftover-axis' },
  'longer-leftover-axis': { select: 'area', split: 'longer-leftover-axis' },
};

/** نرمال‌سازی گزینهٔ نامعتبر به پیش‌فرض (سازگاری با پروژه‌های ذخیره‌شده) */
function resolveVariant(variant: AlgorithmVariant | undefined): keyof typeof VARIANT_RULES {
  if (variant && variant in VARIANT_RULES) return variant as keyof typeof VARIANT_RULES;
  return 'best-area-fit';
}

/**
 * تقسیم گیلوتینی یک مستطیل آزاد بعد از نشستن قطعه در گوشهٔ (x, y) آن.
 * `occupiedW/H` فضای مصرف‌شده از مستطیل آزاد است (قطعه + kerf در جهت‌هایی که
 * بعدش فضا می‌ماند).
 *
 * نکتهٔ مهم kerf: مستطیلِ «زیرِ قطعه» فقط به عرض خود قطعه (`partW`) ساخته
 * می‌شود، نه به عرض فضای اشغالی؛ چون نوار خوراک تیغه در تمام طول خط برش
 * گیلوتینی ادامه دارد.
 */
export function splitFreeRect(
  free: FreeRect,
  partW: number,
  partH: number,
  occupiedW: number,
  occupiedH: number,
  rule: SplitRule = 'shorter-leftover-axis',
): FreeRect[] {
  const leftoverW = free.width - occupiedW;
  const leftoverH = free.height - occupiedH;
  const result: FreeRect[] = [];

  // قاعدهٔ پیش‌فرض نسخه‌های قبلی: برش در محور باقی‌ماندهٔ بزرگ‌تر
  const splitVertically = rule === 'longer-leftover-axis' ? leftoverW < leftoverH : leftoverW >= leftoverH;

  if (splitVertically) {
    // برش عمودی سرتاسری: نوار راست با ارتفاع کامل + تکهٔ زیر قطعه (به عرض خود قطعه)
    if (leftoverW > EPS) {
      result.push({
        x: round2(free.x + occupiedW),
        y: free.y,
        width: round2(leftoverW),
        height: free.height,
      });
    }
    if (leftoverH > EPS) {
      result.push({
        x: free.x,
        y: round2(free.y + occupiedH),
        width: round2(partW),
        height: round2(leftoverH),
      });
    }
  } else {
    // برش افقی سرتاسری: نوار پایین با عرض کامل + تکهٔ کنار قطعه (به ارتفاع خود قطعه)
    if (leftoverH > EPS) {
      result.push({
        x: free.x,
        y: round2(free.y + occupiedH),
        width: free.width,
        height: round2(leftoverH),
      });
    }
    if (leftoverW > EPS) {
      result.push({
        x: round2(free.x + occupiedW),
        y: free.y,
        width: round2(leftoverW),
        height: round2(partH),
      });
    }
  }

  return result;
}

/**
 * ادغام مستطیل‌های آزادی که ضلع مشترکِ کامل دارند (Guillotine Rect Merge).
 * پیاده‌سازی: روی نقشهٔ «ردیف‌های هم‌شکل» حرکت می‌کنیم تا در هر گذر فقط
 * همسایه‌های بالقوه مقایسه شوند (به‌جای حلقهٔ کامل O(n²) روی همهٔ جفت‌ها).
 * رفتار خروجی همان نسخهٔ قبلی است (اولین ادغام معتبر بر اساس ترتیب لیست).
 */
export function mergeFreeRects(rects: FreeRect[]): FreeRect[] {
  const list = [...rects];
  let mergedSomething = true;

  while (mergedSomething) {
    mergedSomething = false;

    // فهرست همسایه‌های بالقوه: هم‌شکل در X (برای ادغام عمودی) یا هم‌شکل در Y (برای افقی)
    outer: for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];

        // روی هم در راستای Y (x و width برابر و چسبیده در جهت عمودی)
        if (a.x === b.x && a.width === b.width) {
          if (round2(a.y + a.height) === b.y || round2(b.y + b.height) === a.y) {
            const y = Math.min(a.y, b.y);
            list.splice(j, 1);
            list[i] = { x: a.x, y, width: a.width, height: round2(a.height + b.height) };
            mergedSomething = true;
            break outer;
          }
        }

        // کنار هم در راستای X (y و height برابر و چسبیده در جهت افقی)
        if (a.y === b.y && a.height === b.height) {
          if (round2(a.x + a.width) === b.x || round2(b.x + b.width) === a.x) {
            const x = Math.min(a.x, b.x);
            list.splice(j, 1);
            list[i] = { x, y: a.y, width: round2(a.width + b.width), height: a.height };
            mergedSomething = true;
            break outer;
          }
        }
      }
    }
  }

  // حذف مستطیل‌هایی که کامل داخل دیگری افتاده‌اند (محض احتیاط)
  return pruneContained(list);
}

/** بهترین جای ممکن برای یک نمونه روی همهٔ صفحه‌های باز (هر دو جهت مجاز) */
function findBestPlacement(
  sheets: WorkingSheet[],
  instance: PartInstance,
  allowRotation: boolean,
  select: 'area' | 'short-side',
): PlacementCandidate | null {
  const orientations = [
    { w: instance.length, h: instance.width, isRotated: false },
    ...(allowRotation && instance.length !== instance.width
      ? [{ w: instance.width, h: instance.length, isRotated: true }]
      : []),
  ];

  let best: PlacementCandidate | null = null;

  for (const sheet of sheets) {
    sheet.freeRects.forEach((free, freeRectIndex) => {
      for (const o of orientations) {
        if (o.w > free.width + EPS || o.h > free.height + EPS) continue;

        const candidate: PlacementCandidate = {
          sheet,
          freeRectIndex,
          w: o.w,
          h: o.h,
          isRotated: o.isRotated,
          areaLeftover: free.width * free.height - o.w * o.h,
          shortSideLeftover: Math.min(free.width - o.w, free.height - o.h),
          longSideLeftover: Math.max(free.width - o.w, free.height - o.h),
        };

        const better =
          select === 'short-side'
            ? compareShortSide(candidate, best)
            : compareBestArea(candidate, best);
        if (better) best = candidate;
      }
    });
  }

  return best;
}

/** مقایسهٔ نسخهٔ قبلی (Best Area Fit → Best Short Side Fit) — عیناً حفظ شده */
function compareBestArea(candidate: PlacementCandidate, best: PlacementCandidate | null): boolean {
  if (!best) return true;
  if (candidate.areaLeftover < best.areaLeftover - EPS) return true;
  if (Math.abs(candidate.areaLeftover - best.areaLeftover) > EPS) return false;
  if (candidate.shortSideLeftover < best.shortSideLeftover - EPS) return true;
  if (Math.abs(candidate.shortSideLeftover - best.shortSideLeftover) > EPS) return false;
  if (candidate.longSideLeftover < best.longSideLeftover - EPS) return true;
  if (Math.abs(candidate.longSideLeftover - best.longSideLeftover) > EPS) return false;
  return !candidate.isRotated && Boolean(best.isRotated);
}

/** Best Short Side Fit → Best Long Side Fit → Best Area Fit */
function compareShortSide(candidate: PlacementCandidate, best: PlacementCandidate | null): boolean {
  if (!best) return true;
  if (candidate.shortSideLeftover < best.shortSideLeftover - EPS) return true;
  if (Math.abs(candidate.shortSideLeftover - best.shortSideLeftover) > EPS) return false;
  if (candidate.longSideLeftover < best.longSideLeftover - EPS) return true;
  if (Math.abs(candidate.longSideLeftover - best.longSideLeftover) > EPS) return false;
  if (candidate.areaLeftover < best.areaLeftover - EPS) return true;
  if (Math.abs(candidate.areaLeftover - best.areaLeftover) > EPS) return false;
  return !candidate.isRotated && Boolean(best.isRotated);
}

/** اعمال یک جایگذاری روی صفحه: مصرف مستطیل آزاد + خوراک تیغه + تقسیم و ادغام */
function applyPlacement(
  candidate: PlacementCandidate,
  instance: PartInstance,
  kerf: number,
  splitRule: SplitRule,
): PlacedPart {
  const { sheet } = candidate;
  const free = sheet.freeRects[candidate.freeRectIndex];

  const placed: PlacedPart = {
    id: instance.id,
    name: instance.name,
    instanceIndex: instance.instanceIndex,
    sheetIndex: sheet.sheetIndex,
    x: round2(free.x),
    y: round2(free.y),
    width: candidate.w,
    height: candidate.h,
    isRotated: candidate.isRotated,
  };

  // خوراک تیغه فقط در جهتی گرفته می‌شود که بعد از قطعه هنوز فضا مانده باشد؛
  // چسبیده به لبهٔ نهایی ⇒ kerf لازم نیست.
  const occupiedW = candidate.w < free.width ? Math.min(free.width, candidate.w + kerf) : free.width;
  const occupiedH = candidate.h < free.height ? Math.min(free.height, candidate.h + kerf) : free.height;

  const remainders = splitFreeRect(free, candidate.w, candidate.h, occupiedW, occupiedH, splitRule);
  sheet.freeRects.splice(candidate.freeRectIndex, 1, ...remainders);
  sheet.freeRects = mergeFreeRects(sheet.freeRects);

  sheet.placements.push(placed);
  sheet.usedArea += candidate.w * candidate.h;
  return placed;
}

/**
 * اجرای چیدمان گیلوتینی روی نمونه‌های آماده.
 * بدون تغییر نسبت به نسخهٔ قبلی برای variant پیش‌فرض.
 */
export function runGuillotine(context: PackingContext): PackingOutcome {
  const { stock, kerf, allowRotation, maxSheets } = context;
  const { select, split } = VARIANT_RULES[resolveVariant(context.selection.variant)];
  const instances = sortInstancesByAreaDesc(context.instances);

  const sheets: WorkingSheet[] = [];
  const unplaced: PackingOutcome['unplaced'] = [];
  const unlimited = !maxSheets || maxSheets <= 0;
  const stockArea = stock.length > 0 && stock.width > 0 ? stock.length * stock.width : 0;

  const openSheet = (): WorkingSheet => {
    const sheet: WorkingSheet = {
      sheetIndex: sheets.length,
      freeRects: [{ x: 0, y: 0, width: stock.length, height: stock.width }],
      placements: [],
      usedArea: 0,
    };
    sheets.push(sheet);
    return sheet;
  };

  for (const instance of instances) {
    let candidate = findBestPlacement(sheets, instance, allowRotation, select);

    if (!candidate && stockArea > 0 && (unlimited || sheets.length < maxSheets)) {
      // یک صفحهٔ تازه باز کن و آنجا امتحان کن
      const freshSheet = openSheet();
      candidate = findBestPlacement([freshSheet], instance, allowRotation, select);
      if (!candidate) {
        // حتی در صفحهٔ خالی هم جا نمی‌شود ⇒ صفحهٔ تازه را پس بگیر و قطعه را رد کن
        sheets.pop();
      }
    }

    if (candidate) {
      applyPlacement(candidate, instance, kerf, split);
    } else {
      const exhausted = !unlimited && sheets.length >= maxSheets && stockArea > 0;
      const tooLarge = !fitsInStock(instance, stock, allowRotation);
      unplaced.push({
        id: instance.id,
        name: instance.name,
        instanceIndex: instance.instanceIndex,
        length: instance.length,
        width: instance.width,
        reason: tooLarge || !exhausted ? 'LARGER_THAN_SHEET' : 'STOCK_EXHAUSTED',
      });
    }
  }

  return {
    sheets: sheets.map((sheet) => ({
      sheetIndex: sheet.sheetIndex,
      placements: sheet.placements,
      usedArea: round2(sheet.usedArea),
      wasteArea: round2(Math.max(0, stockArea - sheet.usedArea)),
      utilizationPercentage: stockArea > 0 ? round2((sheet.usedArea / stockArea) * 100) : 0,
      wastePercentage: stockArea > 0 ? round2((Math.max(0, stockArea - sheet.usedArea) / stockArea) * 100) : 0,
    })),
    placements: sheets.flatMap((sheet) => sheet.placements),
    unplaced,
  };
}

export const guillotineAlgorithm: PackingAlgorithm = {
  id: 'guillotine',
  label: 'گیلوتینی (پیش‌فرض)',
  description:
    'چیدمان با برش‌های سرتاسری لبه‌به‌لبه — تنها روشی که روی ارهٔ پانل‌بُر بدون برش شکسته اجرا می‌شود.',
  variants: [
    { value: 'best-area-fit', label: 'بهترین برازش مساحت (پیش‌فرض)' },
    { value: 'best-short-side-fit', label: 'بهترین برازش ضلع کوتاه' },
    { value: 'shorter-leftover-axis', label: 'تقسیم در محور باقی‌ماندهٔ کوتاه‌تر' },
    { value: 'longer-leftover-axis', label: 'تقسیم در محور باقی‌ماندهٔ بلندتر' },
  ],
  run: runGuillotine,
};

