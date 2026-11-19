/**
 * A-Cut 2Dpro — الگوریتم MaxRects
 * ===============================
 * حالت پیشرفته‌تر از گیلوتینی: فضای آزاد به‌صورت مجموعهٔ مستطیل‌های
 * حداکثری (maximal rectangles) نگه داشته می‌شود، یعنی هر مستطیل آزاد تا
 * جایی که مانعی نباشد بزرگ می‌شود. این کار پرت را کم می‌کند ولی ممکن است
 * چیدمانِ حاصل با برش‌های گیلوتینی ساده قابل اجرا نباشد؛ روی دستگاه CNC
 * یا ارهٔ با پشتیبانی برش شکسته بهترین گزینه است.
 *
 * هیوریستیک‌ها (قابل انتخاب):
 *  - `best-short-side-fit` (پیش‌فرض): کمترین ضلع باقی‌ماندهٔ کوتاه
 *  - `best-area-fit-mr`   : کمترین مساحت باقی‌مانده
 *  - `best-long-side-fit` : کمترین ضلع باقی‌ماندهٔ بلند
 *  - `bottom-left`        : پایین‌ترین و سپس چپ‌ترین مختصات
 */
import {
  EPS,
  pruneContained,
  round2,
  sortInstancesByAreaDesc,
  type FreeRect,
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

export type MaxRectsHeuristic =
  | 'best-short-side-fit'
  | 'best-area-fit-mr'
  | 'best-long-side-fit'
  | 'bottom-left';

interface WorkingSheet {
  sheetIndex: number;
  freeRects: FreeRect[];
  placements: PlacedPart[];
  usedArea: number;
}

interface Candidate {
  sheet: WorkingSheet;
  /** مستطیل آزادی که قطعه در گوشهٔ آن نشست */
  free: FreeRect;
  w: number;
  h: number;
  isRotated: boolean;
  x: number;
  y: number;
  /** امتیاز ترکیبی بر اساس هیوریستیک */
  score1: number;
  score2: number;
}

/**
 * به‌روزرسانی مستطیل‌های آزاد بعد از نشستن قطعه در (x, y) با ابعاد (w, h).
 * قاعدهٔ MaxRects: هر مستطیل آزادی که با قطعه (به‌همراه kerf در سمت راست/پایین)
 * اشتراک دارد، به حداکثر ۴ مستطیل باقی‌مانده شکسته می‌شود و در پایان
 * مستطیل‌های داخل دیگری حذف می‌شوند.
 */
export function splitMaxRects(
  freeRects: FreeRect[],
  placed: { x: number; y: number; width: number; height: number },
): FreeRect[] {
  const { x, y, width, height } = placed;
  const next: FreeRect[] = [];

  for (const free of freeRects) {
    // بدون اشتراک ⇒ دست‌نخورده می‌ماند
    const noOverlap =
      x >= free.x + free.width - EPS ||
      x + width <= free.x + EPS ||
      y >= free.y + free.height - EPS ||
      y + height <= free.y + EPS;
    if (noOverlap) {
      next.push(free);
      continue;
    }

    // بخش بالای قطعه (در مختصات چیدمان، y کوچک‌تر = بالاتر)
    if (y > free.y + EPS) {
      next.push({ x: free.x, y: free.y, width: free.width, height: round2(y - free.y) });
    }
    // بخش پایین قطعه
    if (y + height < free.y + free.height - EPS) {
      next.push({
        x: free.x,
        y: round2(y + height),
        width: free.width,
        height: round2(free.y + free.height - (y + height)),
      });
    }
    // بخش سمت چپ قطعه
    if (x > free.x + EPS) {
      next.push({ x: free.x, y: free.y, width: round2(x - free.x), height: free.height });
    }
    // بخش سمت راست قطعه
    if (x + width < free.x + free.width - EPS) {
      next.push({
        x: round2(x + width),
        y: free.y,
        width: round2(free.x + free.width - (x + width)),
        height: free.height,
      });
    }
  }

  return pruneContained(next.filter((rect) => rect.width > EPS && rect.height > EPS));
}

function selectByHeuristic(
  heuristic: MaxRectsHeuristic,
  free: FreeRect,
  w: number,
  h: number,
  x: number,
  y: number,
): { score1: number; score2: number } {
  const leftoverW = free.width - w;
  const leftoverH = free.height - h;
  switch (heuristic) {
    case 'best-area-fit-mr':
      return { score1: free.width * free.height - w * h, score2: Math.min(leftoverW, leftoverH) };
    case 'best-long-side-fit':
      return { score1: Math.max(leftoverW, leftoverH), score2: Math.min(leftoverW, leftoverH) };
    case 'bottom-left':
      // اولویت به پایین (y کمینه) و سپس چپ (x کمینه)
      return { score1: y + h, score2: x };
    case 'best-short-side-fit':
    default:
      return { score1: Math.min(leftoverW, leftoverH), score2: Math.max(leftoverW, leftoverH) };
  }
}

function isBetter(candidate: Candidate, best: Candidate | null): boolean {
  if (!best) return true;
  if (candidate.score1 < best.score1 - EPS) return true;
  if (Math.abs(candidate.score1 - best.score1) > EPS) return false;
  if (candidate.score2 < best.score2 - EPS) return true;
  if (Math.abs(candidate.score2 - best.score2) > EPS) return false;
  return !candidate.isRotated && best.isRotated;
}

function findCandidate(
  sheets: WorkingSheet[],
  instance: PartInstance,
  allowRotation: boolean,
  heuristic: MaxRectsHeuristic,
  kerf: number,
): Candidate | null {
  const orientations = [
    { w: instance.length, h: instance.width, isRotated: false },
    ...(allowRotation && instance.length !== instance.width
      ? [{ w: instance.width, h: instance.length, isRotated: true }]
      : []),
  ];

  let best: Candidate | null = null;
  for (const sheet of sheets) {
    sheet.freeRects.forEach((free) => {
      for (const o of orientations) {
        if (o.w > free.width + EPS || o.h > free.height + EPS) continue;
        // kerf فقط در جهتی که بعد از قطعه فضا می‌ماند لازم است
        const occupiedW = o.w < free.width ? Math.min(free.width, o.w + kerf) : free.width;
        const occupiedH = o.h < free.height ? Math.min(free.height, o.h + kerf) : free.height;
        if (occupiedW > free.width + EPS || occupiedH > free.height + EPS) continue;
        const { score1, score2 } = selectByHeuristic(heuristic, free, o.w, o.h, free.x, free.y);
        const candidate: Candidate = {
          sheet,
          free: free,
          w: o.w,
          h: o.h,
          isRotated: o.isRotated,
          x: free.x,
          y: free.y,
          score1,
          score2,
        };
        if (isBetter(candidate, best)) best = candidate;
      }
    });
  }
  return best;
}

export function runMaxRects(context: PackingContext): PackingOutcome {
  const { stock, kerf, allowRotation, maxSheets } = context;
  const heuristic = resolveMaxRectsHeuristic(context.selection.variant);
  const instances = sortInstancesByAreaDesc(context.instances);
  const unlimited = !maxSheets || maxSheets <= 0;
  const stockArea = stock.length > 0 && stock.width > 0 ? stock.length * stock.width : 0;

  const sheets: WorkingSheet[] = [];
  const unplaced: PackingOutcome['unplaced'] = [];

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
    let candidate = findCandidate(sheets, instance, allowRotation, heuristic, kerf);
    if (!candidate && stockArea > 0 && (unlimited || sheets.length < maxSheets)) {
      const fresh = openSheet();
      candidate = findCandidate([fresh], instance, allowRotation, heuristic, kerf);
      if (!candidate) sheets.pop();
    }

    if (candidate) {
      const sheet = candidate.sheet;
      const placed: PlacedPart = {
        id: instance.id,
        name: instance.name,
        instanceIndex: instance.instanceIndex,
        sheetIndex: sheet.sheetIndex,
        x: round2(candidate.x),
        y: round2(candidate.y),
        width: candidate.w,
        height: candidate.h,
        isRotated: candidate.isRotated,
      };
      const free = candidate.free;
      // فضای اشغالی شامل kerf (فقط در جهتی که بعد از قطعه جا هست) حفظ می‌شود
      const occupiedW = candidate.w < free.width ? Math.min(free.width, candidate.w + kerf) : free.width;
      const occupiedH = candidate.h < free.height ? Math.min(free.height, candidate.h + kerf) : free.height;
      // نکته: مستطیل مصرف‌شده از لیست حذف نمی‌شود؛ `splitMaxRects` همهٔ مستطیل‌های
      // متقاطع را (از جمله همین یکی) می‌شکند و تکه‌های باقی‌مانده را نگه می‌دارد.
      sheet.freeRects = splitMaxRects(sheet.freeRects, {
        x: free.x,
        y: free.y,
        width: occupiedW,
        height: occupiedH,
      });
      sheet.placements.push(placed);
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

export function resolveMaxRectsHeuristic(variant: AlgorithmVariant | undefined): MaxRectsHeuristic {
  switch (variant) {
    case 'best-area-fit-mr':
    case 'best-long-side-fit':
    case 'bottom-left':
      return variant;
    case 'best-area-fit':
      return 'best-area-fit-mr';
    default:
      return 'best-short-side-fit';
  }
}

export const maxRectsAlgorithm: PackingAlgorithm = {
  id: 'maxrects',
  label: 'MaxRects',
  description:
    'مستطیل‌های آزاد حداکثری؛ پرت کمتر ولی ممکن است خط برش شکسته لازم شود (مناسب CNC).',
  variants: [
    { value: 'best-short-side-fit', label: 'بهترین برازش ضلع کوتاه (پیش‌فرض)' },
    { value: 'best-area-fit-mr', label: 'بهترین برازش مساحت' },
    { value: 'best-long-side-fit', label: 'بهترین برازش ضلع بلند' },
    { value: 'bottom-left', label: 'پایین-چپ (Bottom-Left)' },
  ],
  run: runMaxRects,
};
