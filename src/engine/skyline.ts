/**
 * A-Cut 2Dpro — الگوریتم Skyline
 * ==============================
 * لبهٔ بالاییِ فضای اشغال‌شده به‌صورت یک «خط آسمان» (مجموعه‌ای از پاره‌های
 * افقی با ارتفاع) نگه داشته می‌شود؛ هر قطعه روی پایین‌ترین جای ممکن از این
 * خط می‌نشیند. ساده و سریع است و برای قطعات هم‌ارتفاع (مثل درپوش‌ها) عالی
 * عمل می‌کند.
 *
 * گزینه‌ها:
 *  - `skyline-bottom-left` (پیش‌فرض): کمترین ارتفاع خط، سپس کمترین x
 *  - `skyline-min-waste`           : کمترین پرت زیرِ خط (ارتفاع نشستن + باقی‌مانده)،
 *                                    سپس کمترین ارتفاع — چیدمان فشرده‌تر
 */
import { EPS, fitsInStock, round2, sortInstancesByAreaDesc } from './shared';
import type {
  AlgorithmVariant,
  PackingAlgorithm,
  PackingContext,
  PackingOutcome,
  PartInstance,
  PlacedPart,
} from './types';

interface Segment {
  x: number;
  width: number;
  /** ارتفاع لبهٔ بالاییِ فضای اشغال‌شده (y پایین‌ترین نقطهٔ آزاد) */
  y: number;
}

interface SkylineSheet {
  sheetIndex: number;
  skyline: Segment[];
  placements: PlacedPart[];
  usedArea: number;
}

interface SkylineCandidate {
  sheet: SkylineSheet;
  segmentIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
  isRotated: boolean;
  /** معیار اصلی انتخاب */
  score1: number;
  score2: number;
}

/** ساخت خط آسمان اولیه برای یک ورق خالی */
function initialSkyline(stock: { length: number; width: number }): Segment[] {
  return [{ x: 0, width: stock.length, y: 0 }];
}

/**
 * نشستن قطعه در (x, y) با عرض w روی خط آسمان: پاره‌های زیر قطعه (به‌همراه kerf
 * در سمت راست) با ارتفاع جدید (y + h) جایگزین می‌شوند و پاره‌های هم‌ارتفاع
 * مجاور ادغام می‌شوند.
 */
export function updateSkyline(
  skyline: Segment[],
  placement: { x: number; y: number; width: number; height: number },
  kerf = 0,
  stockWidth = Number.POSITIVE_INFINITY,
): Segment[] {
  const left = round2(placement.x);
  const right = round2(placement.x + placement.width);
  // ارتفاع خط آسمان بعد از قطعه = لبهٔ پایین قطعه + خوراک تیغه (اگر جا باشد)
  const topOfPart = round2(placement.y + placement.height);
  const newY = topOfPart + kerf <= stockWidth + EPS ? round2(topOfPart + kerf) : topOfPart;
  const out: Segment[] = [];

  for (const segment of skyline) {
    const segEnd = round2(segment.x + segment.width);
    // پارهٔ کاملاً بیرون از بازهٔ قطعه
    if (segEnd <= left + EPS || segment.x >= right - EPS) {
      out.push({ ...segment });
      continue;
    }
    // بخش سمت چپ قطعه (بدون تغییر ارتفاع)
    if (segment.x < left - EPS) {
      out.push({ x: segment.x, width: round2(left - segment.x), y: segment.y });
    }
    // بخش سمت راست قطعه (بدون تغییر ارتفاع)
    if (segEnd > right + EPS) {
      out.push({ x: right, width: round2(segEnd - right), y: segment.y });
    }
  }

  // خود بازهٔ قطعه با ارتفاع جدید
  out.push({ x: left, width: round2(right - left), y: newY });
  out.sort((a, b) => a.x - b.x);

  // ادغام پاره‌های هم‌ارتفاع مجاور
  const merged: Segment[] = [];
  for (const segment of out) {
    const last = merged[merged.length - 1];
    if (last && Math.abs(last.y - segment.y) < EPS && Math.abs(round2(last.x + last.width) - segment.x) < EPS) {
      last.width = round2(last.width + segment.width);
    } else {
      merged.push({ ...segment });
    }
  }
  return merged.filter((segment) => segment.width > EPS);
}

/** کمینه و بیشینهٔ ارتفاع خط آسمان در بازهٔ [start, end) */
function rangeHeight(skyline: Segment[], start: number, end: number): { min: number; max: number } | null {
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  let covered = false;
  for (const segment of skyline) {
    const segEnd = round2(segment.x + segment.width);
    if (segEnd <= start + EPS || segment.x >= end - EPS) continue;
    covered = true;
    min = Math.min(min, segment.y);
    max = Math.max(max, segment.y);
  }
  return covered ? { min, max } : null;
}

function findCandidate(
  sheets: SkylineSheet[],
  instance: PartInstance,
  allowRotation: boolean,
  minWaste: boolean,
  kerf: number,
  stock: { length: number; width: number },
): SkylineCandidate | null {
  const orientations = [
    { w: instance.length, h: instance.width, isRotated: false },
    ...(allowRotation && instance.length !== instance.width
      ? [{ w: instance.width, h: instance.length, isRotated: true }]
      : []),
  ];

  let best: SkylineCandidate | null = null;
  for (const sheet of sheets) {
    sheet.skyline.forEach((segment, segmentIndex) => {
      for (const orientation of orientations) {
        if (segment.x + orientation.w > stock.length + EPS) continue;
        // kerf فقط وقتی لازم است که بعد از قطعه هنوز فضا بماند
        const spanWidth =
          segment.x + orientation.w + kerf <= stock.length + EPS ? orientation.w + kerf : orientation.w;
        const height = rangeHeight(
          sheet.skyline,
          segment.x,
          Math.min(stock.length, segment.x + spanWidth),
        );
        if (!height) continue;
        const y = height.max;
        if (y + orientation.h > stock.width + EPS) continue;

        const wastedArea =
          minWaste
            ? (y - height.min) * spanWidth + (stock.width - y - orientation.h) * orientation.w
            : 0;
        const candidate: SkylineCandidate = {
          sheet,
          segmentIndex,
          x: segment.x,
          y,
          w: orientation.w,
          h: orientation.h,
          isRotated: orientation.isRotated,
          score1: minWaste ? wastedArea : y,
          score2: minWaste ? y : segment.x,
        };
        if (
          !best ||
          candidate.score1 < best.score1 - EPS ||
          (Math.abs(candidate.score1 - best.score1) <= EPS &&
            (candidate.score2 < best.score2 - EPS ||
              (Math.abs(candidate.score2 - best.score2) <= EPS &&
                !candidate.isRotated &&
                best.isRotated)))
        ) {
          best = candidate;
        }
      }
    });
  }
  return best;
}

export function runSkyline(context: PackingContext): PackingOutcome {
  const { stock, kerf, allowRotation, maxSheets } = context;
  const minWaste = context.selection.variant === 'skyline-min-waste';
  const instances = sortInstancesByAreaDesc(context.instances);
  const unlimited = !maxSheets || maxSheets <= 0;
  const stockArea = stock.length > 0 && stock.width > 0 ? stock.length * stock.width : 0;

  const sheets: SkylineSheet[] = [];
  const unplaced: PackingOutcome['unplaced'] = [];

  const openSheet = (): SkylineSheet => {
    const sheet: SkylineSheet = {
      sheetIndex: sheets.length,
      skyline: initialSkyline(stock),
      placements: [],
      usedArea: 0,
    };
    sheets.push(sheet);
    return sheet;
  };

  for (const instance of instances) {
    let candidate = findCandidate(sheets, instance, allowRotation, minWaste, kerf, stock);
    if (!candidate && stockArea > 0 && (unlimited || sheets.length < maxSheets)) {
      const fresh = openSheet();
      candidate = findCandidate([fresh], instance, allowRotation, minWaste, kerf, stock);
      if (!candidate) sheets.pop();
    }

    if (candidate) {
      const sheet = candidate.sheet;
      sheet.skyline = updateSkyline(
        sheet.skyline,
        { x: candidate.x, y: candidate.y, width: candidate.w, height: candidate.h },
        kerf,
        stock.width,
      );
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

export function resolveSkylineVariant(variant: AlgorithmVariant | undefined): 'bottom-left' | 'min-waste' {
  return variant === 'skyline-min-waste' ? 'min-waste' : 'bottom-left';
}

export const skylineAlgorithm: PackingAlgorithm = {
  id: 'skyline',
  label: 'Skyline',
  description: 'چیدمان ردیفی روی «خط آسمان»؛ سریع و مناسب قطعات هم‌ارتفاع.',
  variants: [
    { value: 'skyline-bottom-left', label: 'پایین-چپ (پیش‌فرض)' },
    { value: 'skyline-min-waste', label: 'کمینهٔ پرت' },
  ],
  run: runSkyline,
};
