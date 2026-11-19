/**
 * A-Cut 2Dpro — الگوریتم Shelf (قفسه‌ای / NFDH)
 * =============================================
 * ساده‌ترین چیدمان: قطعات در «ردیف‌های» افقی با ارتفاع ثابت (ارتفاع بلندترین
 * قطعهٔ ردیف) و از چپ به راست چیده می‌شوند. خط برش‌ها کاملاً سرتاسری و
 * قابل‌اجرا روی ارهٔ پانل‌بُر است — مرجع خوبی برای مقایسه است، ولی معمولاً
 * پرت بیشتری از گیلوتینی/MaxRects دارد.
 *
 * گزینه‌ها:
 *  - `shelf-first-fit` (پیش‌فرض): نزولی بر اساس ارتفاع + اولین ردیفِ جا‌دار
 *    (معادل Next-Fit-Decreasing-Height با ادامه در ردیف‌های باز)
 *  - `shelf-best-fit`           : از میان ردیف‌های باز، ردیفی که کمترین
 *    ارتفاع باقی‌مانده را دارد انتخاب می‌شود
 */
import {
  EPS,
  round2,
  sortInstancesByAreaDesc,
  fitsInStock,
} from './shared';
import type {
  AlgorithmVariant,
  PackingAlgorithm,
  PackingContext,
  PackingOutcome,
  PartInstance,
  PlacedPart,
} from './types';

interface Shelf {
  /** ارتفاع لبهٔ بالایی ردیف در مختصات چیدمان (y) */
  y: number;
  /** ارتفاع ردیف (بلندترین قطعه) */
  height: number;
  /** عرض مصرف‌شده تا این لحظه (شامل kerf) */
  usedWidth: number;
}

interface ShelfSheet {
  sheetIndex: number;
  shelves: Shelf[];
  placements: PlacedPart[];
  usedArea: number;
}

interface ShelfCandidate {
  sheet: ShelfSheet;
  shelfIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
  isRotated: boolean;
  /** امتیاز: برای first-fit = شاخص ردیف (کوچک‌تر بهتر)، برای best-fit = ارتفاع باقی‌مانده */
  score: number;
}

function findCandidate(
  sheets: ShelfSheet[],
  instance: PartInstance,
  allowRotation: boolean,
  bestFit: boolean,
  kerf: number,
  stock: { length: number; width: number },
): ShelfCandidate | null {
  const orientations = [
    { w: instance.length, h: instance.width, isRotated: false },
    ...(allowRotation && instance.length !== instance.width
      ? [{ w: instance.width, h: instance.length, isRotated: true }]
      : []),
  ];

  let best: ShelfCandidate | null = null;
  for (const sheet of sheets) {
    sheet.shelves.forEach((shelf, shelfIndex) => {
      for (const orientation of orientations) {
        if (shelf.usedWidth + orientation.w > stock.length + EPS) continue;
        // در ردیف موجود، ارتفاع قطعه باید در ارتفاع ردیف جا شود
        if (orientation.h > shelf.height + EPS) continue;
        const candidate: ShelfCandidate = {
          sheet,
          shelfIndex,
          x: shelf.usedWidth,
          y: shelf.y,
          w: orientation.w,
          h: orientation.h,
          isRotated: orientation.isRotated,
          score: bestFit ? shelf.height - orientation.h : sheet.sheetIndex * 1000 + shelfIndex,
        };
        if (
          !best ||
          candidate.score < best.score - EPS ||
          (Math.abs(candidate.score - best.score) <= EPS &&
            shelfIndex < best.shelfIndex &&
            !candidate.isRotated &&
            best.isRotated)
        ) {
          best = candidate;
        }
      }
    });

    // ردیف تازه در همین ورق
    const last = sheet.shelves[sheet.shelves.length - 1];
    const newShelfY = last ? round2(last.y + last.height + (last.height > 0 ? kerf : 0)) : 0;
    for (const orientation of orientations) {
      if (orientation.w > stock.length + EPS) continue;
      if (newShelfY + orientation.h > stock.width + EPS) continue;
      const candidate: ShelfCandidate = {
        sheet,
        shelfIndex: sheet.shelves.length,
        x: 0,
        y: newShelfY,
        w: orientation.w,
        h: orientation.h,
        isRotated: orientation.isRotated,
        // ردیف تازه همیشه در اولویت بعد از ردیف‌های موجود است، مگر best-fit
        score: bestFit ? stock.width - newShelfY : sheet.sheetIndex * 1000 + sheet.shelves.length,
      };
      if (!best || candidate.score < best.score - EPS) best = candidate;
    }
  }
  return best;
}

export function runShelf(context: PackingContext): PackingOutcome {
  const { stock, kerf, allowRotation, maxSheets } = context;
  const bestFit = context.selection.variant === 'shelf-best-fit';
  // NFDH: مرتب‌سازی نزولی بر اساس ارتفاع (بعد بزرگ‌ترین بُعد) — و در نسخهٔ ما مساحت
  const instances = sortInstancesByAreaDesc(
    [...context.instances].sort((a, b) => b.width - a.width || b.area - a.area),
  );
  const unlimited = !maxSheets || maxSheets <= 0;
  const stockArea = stock.length > 0 && stock.width > 0 ? stock.length * stock.width : 0;

  const sheets: ShelfSheet[] = [];
  const unplaced: PackingOutcome['unplaced'] = [];

  const openSheet = (): ShelfSheet => {
    const sheet: ShelfSheet = { sheetIndex: sheets.length, shelves: [], placements: [], usedArea: 0 };
    sheets.push(sheet);
    return sheet;
  };

  for (const instance of instances) {
    let candidate = findCandidate(sheets, instance, allowRotation, bestFit, kerf, stock);

    if (!candidate) {
      // ردیف موجود جا ندارد: در ورقی نو ردیف تازه باز کن
      if (stockArea > 0 && (unlimited || sheets.length < maxSheets)) {
        const fresh = openSheet();
        candidate = findCandidate([fresh], instance, allowRotation, bestFit, kerf, stock);
        if (!candidate) sheets.pop();
      }
    }

    if (candidate) {
      const sheet = candidate.sheet;
      if (candidate.shelfIndex >= sheet.shelves.length) {
        sheet.shelves.push({ y: candidate.y, height: candidate.h, usedWidth: 0 });
      }
      const shelf = sheet.shelves[candidate.shelfIndex];
      shelf.height = Math.max(shelf.height, candidate.h);
      shelf.usedWidth = round2(shelf.usedWidth + candidate.w + kerf);
      sheet.placements.push({
        id: instance.id,
        name: instance.name,
        instanceIndex: instance.instanceIndex,
        sheetIndex: sheet.sheetIndex,
        x: round2(candidate.x),
        y: round2(candidate.y),
        width: candidate.w,
        height: candidate.h,
        isRotated: candidate.isRotated,
      });
      sheet.usedArea += candidate.w * candidate.h;
    } else {
      const exhausted = !unlimited && sheets.length >= maxSheets && stockArea > 0;
      unplaced.push({
        id: instance.id,
        name: instance.name,
        instanceIndex: instance.instanceIndex,
        length: instance.length,
        width: instance.width,
        reason: fitsInStock(instance, stock, allowRotation) && exhausted ? 'STOCK_EXHAUSTED' : 'LARGER_THAN_SHEET',
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

export function resolveShelfVariant(variant: AlgorithmVariant | undefined): 'first-fit' | 'best-fit' {
  return variant === 'shelf-best-fit' ? 'best-fit' : 'first-fit';
}

export const shelfAlgorithm: PackingAlgorithm = {
  id: 'shelf',
  label: 'Shelf / NFDH',
  description: 'چیدمان ردیفی ساده با برش‌های سرتاسری؛ سریع و مرجع مقایسه.',
  variants: [
    { value: 'shelf-first-fit', label: 'اولین ردیف جا‌دار (پیش‌فرض)' },
    { value: 'shelf-best-fit', label: 'بهترین ردیف (کمترین ارتفاع باقی‌مانده)' },
  ],
  run: runShelf,
};
