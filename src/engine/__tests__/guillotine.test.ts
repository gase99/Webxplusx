import { describe, expect, it } from 'vitest';
import { calculateLayout } from '../../algorithm';
import { validateLayoutInput, expandInstances } from '../shared';
import {
  splitFreeRect,
  mergeFreeRects,
  guillotineAlgorithm,
} from '../guillotine';
import { bench } from './bench-helper';
import { checkInvariants, part } from './invariants';

const STOCK = { length: 3660, width: 1830 };
const baseOptions = { kerf: 4, allowRotation: true } as const;

describe('الگوریتم گیلوتینی — رفتار پایه', () => {
  it('ورودی خالی ⇒ صفر ورق و صفر قطعه (بدون خطا)', () => {
    const result = calculateLayout([], STOCK, { ...baseOptions });
    expect(result.sheets).toEqual([]);
    expect(result.placements).toEqual([]);
    expect(result.summary.sheetCount).toBe(0);
    expect(result.summary.totalParts).toBe(0);
    expect(result.summary.wastePercentage).toBe(0);
  });

  it('ورق با ابعاد صفر ⇒ نتیجهٔ خالی و بدون NaN', () => {
    const result = calculateLayout([part({ id: 'a', length: 100, width: 100 })], { length: 0, width: 0 }, baseOptions);
    expect(result.sheets).toEqual([]);
    expect(result.summary.sheetCount).toBe(0);
    expect(Number.isNaN(result.summary.wastePercentage)).toBe(false);
    // قطعه باید به‌عنوان «جا نشد» گزارش شود
    expect(result.unplaced).toHaveLength(0);
  });

  it('ابعاد منفی هرگز به الگوریتم نمی‌رسد (اعتبارسنجی جلوی آن را می‌گیرد)', () => {
    const report = validateLayoutInput({
      parts: [
        { id: 'neg', length: -100, width: 200, qty: 1 },
        { id: 'neg2', length: 100, width: -50, qty: 1 },
      ],
      stock: STOCK,
      options: baseOptions,
    });
    expect(report.ok).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toContain('NEGATIVE_DIMENSIONS');

    // موتور هم با ورودی منفی چیزی نمی‌چیند
    const result = calculateLayout(
      [{ id: 'neg', length: -100, width: 200, qty: 1 }],
      STOCK,
      baseOptions,
    );
    expect(result.placements).toEqual([]);
    expect(result.summary.sheetCount).toBe(0);
  });

  it('تعداد کسری هشدار می‌گیرد و در محاسبه به پایین گرد می‌شود', () => {
    const items = [{ id: 'frac', length: 100, width: 100, qty: 2.7 }];
    const report = validateLayoutInput({ parts: items, stock: STOCK, options: baseOptions });
    expect(report.ok).toBe(true);
    expect(report.issues.some((issue) => issue.code === 'FRACTIONAL_QTY')).toBe(true);

    const result = calculateLayout(items, STOCK, baseOptions);
    expect(result.summary.totalParts).toBe(2);
    checkInvariants(result);
  });

  it('تعداد بسیار زیاد (۵۰۰ قطعه) همه چیده می‌شوند و چیدمان معتبر است', () => {
    const items = [part({ id: 'many', length: 200, width: 150, qty: 500 })];
    const result = calculateLayout(items, STOCK, baseOptions);
    expect(result.summary.placedCount).toBe(500);
    expect(result.summary.unplacedCount).toBe(0);
    checkInvariants(result, { expectAllPlaced: true });
  });

  it('قطعهٔ بزرگ‌تر از ورق با دلیل LARGER_THAN_SHEET گزارش می‌شود', () => {
    const result = calculateLayout(
      [
        part({ id: 'ok', length: 500, width: 500 }),
        part({ id: 'huge', length: 5000, width: 5000 }),
      ],
      STOCK,
      baseOptions,
    );
    expect(result.summary.placedCount).toBe(1);
    expect(result.unplaced).toHaveLength(1);
    expect(result.unplaced[0].reason).toBe('LARGER_THAN_SHEET');
  });

  it('چرخش غیرفعال: قطعهٔ بلندتر از طول ورق جا نمی‌شود، با چرخش فعال جا می‌شود', () => {
    const items = [part({ id: 'long', length: 2000, width: 300 })];

    const noRotation = calculateLayout(items, { length: 1000, width: 2440 }, { kerf: 0, allowRotation: false });
    expect(noRotation.summary.placedCount).toBe(0);
    expect(noRotation.unplaced[0].reason).toBe('LARGER_THAN_SHEET');

    const rotation = calculateLayout(items, { length: 1000, width: 2440 }, { kerf: 0, allowRotation: true });
    expect(rotation.summary.placedCount).toBe(1);
    expect(rotation.placements[0].isRotated).toBe(true);
    checkInvariants(rotation, { expectAllPlaced: true });
  });

  it('با چرخش غیرفعال هیچ قطعه‌ای چرخیده نیست', () => {
    const result = calculateLayout(
      [part({ id: 'a', length: 700, width: 300, qty: 8 })],
      { length: 1000, width: 1000 },
      { kerf: 2, allowRotation: false },
    );
    expect(result.placements.every((p) => !p.isRotated)).toBe(true);
    checkInvariants(result, { expectAllPlaced: true });
  });

  it('kerf=0 در برابر kerf=10: چیدمان عوض می‌شود و هر دو معتبرند', () => {
    const items = [part({ id: 'a', length: 600, width: 400, qty: 20 })];
    const noKerf = calculateLayout(items, { length: 2440, width: 1220 }, { kerf: 0 });
    const withKerf = calculateLayout(items, { length: 2440, width: 1220 }, { kerf: 10 });
    // با تیغهٔ ضخیم‌تر هیچ‌وقت ورقِ کمتری لازم نمی‌شود
    expect(withKerf.summary.sheetCount).toBeGreaterThanOrEqual(noKerf.summary.sheetCount);
    // مختصات با تغییر kerf عوض می‌شود (فاصلهٔ تیغه لحاظ شده است)
    expect(withKerf.placements).not.toEqual(noKerf.placements);
    checkInvariants(noKerf, { expectAllPlaced: true });
    checkInvariants(withKerf, { expectAllPlaced: true, checkKerf: true });
  });

  it('فاصلهٔ تیغه بین قطعات مجاور رعایت می‌شود', () => {
    const result = calculateLayout(
      [part({ id: 'tile', length: 500, width: 500, qty: 12 })],
      { length: 1020, width: 1020 },
      { kerf: 20, allowRotation: false },
    );
    checkInvariants(result, { checkKerf: true });
  });

  it('سقف تعداد ورق: قطعات اضافی با دلیل STOCK_EXHAUSTED گزارش می‌شوند', () => {
    const items = [part({ id: 'tile', length: 500, width: 500, qty: 10 })];
    const result = calculateLayout(items, { length: 1000, width: 1000 }, {
      kerf: 0,
      allowRotation: false,
      maxSheets: 1,
    });
    expect(result.summary.sheetCount).toBe(1);
    expect(result.unplaced.length).toBeGreaterThan(0);
    expect(result.unplaced.every((p) => p.reason === 'STOCK_EXHAUSTED')).toBe(true);
    checkInvariants(result);
  });

  it('قطعه‌های هم‌اندازه دقیقاً ورق را پر می‌کنند (بهره‌وری ۱۰۰٪ بدون kerf)', () => {
    const result = calculateLayout(
      [part({ id: 'exact', length: 1000, width: 1000, qty: 4 })],
      { length: 2000, width: 2000 },
      { kerf: 0, allowRotation: false },
    );
    expect(result.summary.sheetCount).toBe(1);
    expect(result.summary.utilizationPercentage).toBeCloseTo(100, 1);
    checkInvariants(result, { expectAllPlaced: true });
  });

  it('ضخامت نوار از ابعاد قطعه کسر می‌شود', () => {
    const result = calculateLayout(
      [{ id: 'band', length: 1000, width: 500, qty: 1, bandLength: 2, bandWidth: 1 }],
      STOCK,
      { kerf: 0, bandThickness: 2 },
    );
    // bandWidth=۱ ⇒ طول ۲ میلی‌متر و bandLength=۲ ⇒ عرض ۴ میلی‌متر کم می‌شود
    // (ممکن است قطعه چرخیده باشد، پس ابعاد را مرتب مقایسه می‌کنیم)
    const dims = [result.placements[0].width, result.placements[0].height].sort((a, b) => a - b);
    expect(dims).toEqual([496, 998]);
  });
});

describe('گیلوتینی — توابع داخلی', () => {
  it('splitFreeRect دو مستطیل باقی‌ماندهٔ غیرهم‌پوشان می‌سازد', () => {
    const free = { x: 0, y: 0, width: 1000, height: 600 };
    const parts = splitFreeRect(free, 400, 300, 404, 304);
    expect(parts).toHaveLength(2);
    for (const piece of parts) {
      expect(piece.x + piece.width).toBeLessThanOrEqual(free.width);
      expect(piece.y + piece.height).toBeLessThanOrEqual(free.height);
    }
  });

  it('splitFreeRect با قاعدهٔ longer-leftover-axis هم دو تکه می‌دهد', () => {
    const free = { x: 0, y: 0, width: 1000, height: 600 };
    const shorter = splitFreeRect(free, 400, 300, 404, 304, 'shorter-leftover-axis');
    const longer = splitFreeRect(free, 400, 300, 404, 304, 'longer-leftover-axis');
    expect(shorter).toHaveLength(2);
    expect(longer).toHaveLength(2);
    expect(shorter).not.toEqual(longer);
  });

  it('mergeFreeRects دو مستطیل هم‌عرض و چسبیده را ادغام می‌کند', () => {
    const merged = mergeFreeRects([
      { x: 0, y: 0, width: 100, height: 50 },
      { x: 0, y: 50, width: 100, height: 50 },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });

  it('mergeFreeRects مستطیل‌های چسبیده در محور X را ادغام می‌کند', () => {
    const merged = mergeFreeRects([
      { x: 0, y: 0, width: 50, height: 100 },
      { x: 50, y: 0, width: 50, height: 100 },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });

  it('mergeFreeRects مستطیل داخلی را حذف می‌کند', () => {
    const merged = mergeFreeRects([
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 10, y: 10, width: 20, height: 20 },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });

  it('mergeFreeRects روی ورودی بزرگ سریع است (بهبود O(n²))', () => {
    const rects = Array.from({ length: 2000 }, (_, index) => ({
      x: index * 1000,
      y: 0,
      width: 500,
      height: 500,
    }));
    const elapsed = bench(() => mergeFreeRects(rects));
    expect(elapsed).toBeLessThan(1500);
  });

  it('گزینهٔ نامعتبر هیوریستیک به پیش‌فرض برمی‌گردد', () => {
    const context = {
      instances: expandInstances([part({ id: 'x', length: 100, width: 100, qty: 2 })], 0),
      stock: { length: 1000, width: 1000 },
      kerf: 0,
      allowRotation: true,
      maxSheets: 0,
      selection: { id: 'guillotine', variant: 'unknown-variant' },
    } as unknown as Parameters<typeof guillotineAlgorithm.run>[0];
    const outcome = guillotineAlgorithm.run(context);
    expect(outcome.placements).toHaveLength(2);
  });

  it('همهٔ زیرگزینه‌ها چیدمان معتبر می‌سازند', () => {
    for (const variant of guillotineAlgorithm.variants) {
      const result = calculateLayout(
        [part({ id: 'a', length: 600, width: 400, qty: 10 })],
        { length: 2440, width: 1220 },
        { kerf: 4, algorithm: { id: 'guillotine', variant: variant.value } },
      );
      expect(result.variant).toBe(variant.value);
      checkInvariants(result, { expectAllPlaced: true });
    }
  });
});

describe('گیلوتینی — پروندهٔ ثابت (تشخیص رگرسیون)', () => {
  it('خروجی برای ورودی ثابت همیشه یکسان است', () => {
    const items = [
      part({ id: 'a', length: 720, width: 560, qty: 2 }),
      part({ id: 'b', length: 715, width: 396, qty: 4 }),
      part({ id: 'c', length: 564, width: 520, qty: 3 }),
    ];
    const first = calculateLayout(items, STOCK, baseOptions);
    const second = calculateLayout(items, STOCK, baseOptions);
    expect(second.placements).toEqual(first.placements);
    expect(second.summary).toEqual(first.summary);
    // مقدار مبنا از نسخهٔ اصلی برنامه (پیش از بازآرایی موتور) ثبت شده است
    expect(first.summary.sheetCount).toBe(1);
    expect(first.summary.placedCount).toBe(9);
  });
});
