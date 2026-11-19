import { describe, expect, it } from 'vitest';
import { calculateLayout, compareAlgorithms, runLayout } from '../../algorithm';
import { ALGORITHMS, defaultVariantFor, normalizeSelection } from '../registry';
import { benchmarkDataset, checkInvariants, part } from './invariants';
import type { AlgorithmSelection, LayoutPartInput, LayoutResult } from '../types';

const STOCK = { length: 3660, width: 1830 };
const BASE = { kerf: 4, allowRotation: true } as const;

/** اجرای همهٔ گزینه‌های همهٔ الگوریتم‌ها با یک ورودی ثابت */
function runAllVariants(parts: LayoutPartInput[], stock = STOCK, options: Record<string, unknown> = {}) {
  const results: { selection: AlgorithmSelection; result: LayoutResult }[] = [];
  for (const algorithm of ALGORITHMS) {
    for (const variant of algorithm.variants) {
      const selection: AlgorithmSelection = {
        id: algorithm.id,
        variant: variant.value,
        // برای سرعت تست، تکرار بهینه‌ساز کم است
        iterations: algorithm.id === 'optimizer' ? 12 : undefined,
        seed: algorithm.id === 'optimizer' ? 7 : undefined,
      };
      const { result } = runLayout({ parts, stock, options: { ...BASE, ...options }, selection });
      results.push({ selection, result });
    }
  }
  return results;
}

describe('ناوَریانت‌های مشترک همهٔ الگوریتم‌ها', () => {
  it('همهٔ حالت‌ها روی پروندهٔ ثابت چیدمان معتبر می‌سازند', () => {
    const results = runAllVariants(benchmarkDataset());
    expect(results.length).toBeGreaterThanOrEqual(13);
    for (const { selection, result } of results) {
      expect(result.algorithm).toBe(selection.id);
      expect(result.variant).toBe(selection.variant);
      checkInvariants(result, { expectAllPlaced: true, checkKerf: true });
    }
  });

  it('همهٔ حالت‌ها با ورودی خالی خروجی خالی و بدون خطا می‌دهند', () => {
    for (const { result } of runAllVariants([])) {
      expect(result.sheets).toEqual([]);
      expect(result.placements).toEqual([]);
      expect(result.summary.sheetCount).toBe(0);
      expect(Number.isNaN(result.summary.wastePercentage)).toBe(false);
    }
  });

  it('همهٔ حالت‌ها یک قطعهٔ ساده را می‌چینند', () => {
    for (const { result } of runAllVariants([part({ id: 'one', length: 800, width: 400 })])) {
      expect(result.summary.placedCount).toBe(1);
      const placed = result.placements[0];
      expect(placed.x).toBe(0);
      expect(placed.y).toBe(0);
      checkInvariants(result, { expectAllPlaced: true });
    }
  });

  it('همهٔ حالت‌ها قطعهٔ بزرگ‌تر از ورق را رد می‌کنند', () => {
    for (const { result } of runAllVariants([part({ id: 'huge', length: 9000, width: 9000 })])) {
      expect(result.summary.placedCount).toBe(0);
      expect(result.unplaced).toHaveLength(1);
      expect(result.unplaced[0].reason).toBe('LARGER_THAN_SHEET');
    }
  });

  it('چرخش غیرفعال: هیچ قطعه‌ای چرخیده نیست و قطعهٔ بلندتر از ورق جا نمی‌شود', () => {
    const parts = [
      part({ id: 'long', length: 3000, width: 200 }),
      part({ id: 'small', length: 500, width: 400, qty: 3 }),
    ];
    for (const { result } of runAllVariants(parts, { length: 2440, width: 1220 }, { allowRotation: false })) {
      expect(result.placements.every((p) => !p.isRotated)).toBe(true);
      // قطعهٔ ۳۰۰۰×۲۰۰ در ورق ۲۴۴۰×۱۲۲۰ بدون چرخش جا نمی‌شود
      expect(result.unplaced.some((p) => p.id === 'long')).toBe(true);
      checkInvariants(result);
    }
  });

  it('چرخش فعال: قطعهٔ بلندتر از طول ورق چرخیده و چیده می‌شود', () => {
    for (const { result } of runAllVariants(
      [part({ id: 'long', length: 2000, width: 300 })],
      { length: 1000, width: 2440 },
      { allowRotation: true },
    )) {
      expect(result.summary.placedCount).toBe(1);
      expect(result.placements[0].isRotated).toBe(true);
      checkInvariants(result, { expectAllPlaced: true });
    }
  });

  it('kerf و ضخامت نوار در همهٔ حالت‌ها اعمال می‌شوند', () => {
    for (const { result } of runAllVariants(
      [{ id: 'band', length: 1200, width: 600, qty: 4, bandLength: 2, bandWidth: 1 }],
      STOCK,
      { kerf: 6, bandThickness: 2 },
    )) {
      expect(result.kerf).toBe(6);
      expect(result.bandThickness).toBe(2);
      const dims = [result.placements[0].width, result.placements[0].height].sort((a, b) => a - b);
      expect(dims).toEqual([596, 1198]);
      checkInvariants(result, { expectAllPlaced: true, checkKerf: true });
    }
  });

  it('سقف ورق در همهٔ حالت‌ها رعایت می‌شود', () => {
    for (const { result } of runAllVariants(
      [part({ id: 'tile', length: 500, width: 500, qty: 40 })],
      { length: 1000, width: 1000 },
      { kerf: 0, maxSheets: 2, allowRotation: false },
    )) {
      expect(result.summary.sheetCount).toBeLessThanOrEqual(2);
      expect(result.unplaced.length).toBeGreaterThan(0);
      checkInvariants(result);
    }
  });
});

describe('بهینه‌ساز (Annealing)', () => {
  const parts = benchmarkDataset();

  it('با بذر و تکرار یکسان، خروجی بازتولیدپذیر است', () => {
    const selection: AlgorithmSelection = { id: 'optimizer', variant: 'sa-maxrects', iterations: 15, seed: 42 };
    const first = calculateLayout(parts, STOCK, { ...BASE, algorithm: selection });
    const second = calculateLayout(parts, STOCK, { ...BASE, algorithm: selection });
    expect(second.placements).toEqual(first.placements);
    expect(second.summary).toEqual(first.summary);
  });

  it('بذر متفاوت هم نتیجهٔ معتبر و هم‌کیفیت می‌دهد', () => {
    const a = calculateLayout(parts, STOCK, {
      ...BASE,
      algorithm: { id: 'optimizer', variant: 'sa-maxrects', iterations: 12, seed: 1 },
    });
    const b = calculateLayout(parts, STOCK, {
      ...BASE,
      algorithm: { id: 'optimizer', variant: 'sa-maxrects', iterations: 12, seed: 999 },
    });
    // ممکن است هر دو به همان بهینهٔ محلی برسند؛ آنچه مهم است اعتبار است
    expect(a.summary.sheetCount).toBe(b.summary.sheetCount);
    expect(a.summary.unplacedCount).toBe(0);
    expect(b.summary.unplacedCount).toBe(0);
    checkInvariants(a, { expectAllPlaced: true });
    checkInvariants(b, { expectAllPlaced: true });
  });

  it('لغو محاسبه نتیجهٔ معتبر برمی‌گرداند', () => {
    const signal = { aborted: true };
    const { result } = runLayout({
      parts,
      stock: STOCK,
      options: { ...BASE, signal },
      selection: { id: 'optimizer', variant: 'sa-maxrects', iterations: 100, seed: 3 },
    });
    checkInvariants(result, { expectAllPlaced: true });
  });

  it('گزارش پیشرفت صدا زده می‌شود و در انتها به ۱ می‌رسد', () => {
    const ratios: number[] = [];
    runLayout({
      parts,
      stock: STOCK,
      options: { ...BASE, onProgress: (p) => ratios.push(p.ratio) },
      selection: { id: 'optimizer', variant: 'sa-maxrects', iterations: 20, seed: 5 },
    });
    expect(ratios.length).toBeGreaterThan(1);
    expect(ratios[ratios.length - 1]).toBe(1);
  });

  it('بهینه‌ساز از حالت تصادفی بدتر از گیلوتینی نیست (تعداد ورق)', () => {
    const guillotine = calculateLayout(parts, STOCK, { ...BASE, algorithm: { id: 'guillotine', variant: 'best-area-fit' } });
    const optimizer = calculateLayout(parts, STOCK, {
      ...BASE,
      algorithm: { id: 'optimizer', variant: 'sa-maxrects', iterations: 30, seed: 11 },
    });
    expect(optimizer.summary.sheetCount).toBeLessThanOrEqual(guillotine.summary.sheetCount);
  });
});

describe('مقایسهٔ الگوریتم‌ها', () => {
  it('همهٔ الگوریتم‌ها یک ردیف نتیجه دارند و بهترین‌ها مشخص می‌شوند', () => {
    const comparison = compareAlgorithms({ parts: benchmarkDataset(), stock: STOCK, options: BASE });
    expect(comparison.runs).toHaveLength(ALGORITHMS.length);
    expect(comparison.runs.every((run) => !run.error)).toBe(true);
    expect(comparison.bestBySheets).not.toBeNull();
    expect(comparison.bestByWaste).not.toBeNull();
    for (const run of comparison.runs) {
      checkInvariants(run.result);
      expect(run.result.summary.sheetCount).toBeLessThanOrEqual(
        Math.max(...comparison.runs.map((r) => r.result.summary.sheetCount)),
      );
    }
    expect(comparison.bestBySheets!.result.summary.sheetCount).toBe(
      Math.min(...comparison.runs.map((r) => r.result.summary.sheetCount)),
    );
  });

  it('مقایسه با انتخاب محدود فقط همان‌ها را اجرا می‌کند', () => {
    const comparison = compareAlgorithms(
      { parts: benchmarkDataset(), stock: STOCK, options: BASE },
      [
        { id: 'guillotine', variant: 'best-area-fit' },
        { id: 'shelf', variant: 'shelf-first-fit' },
      ],
    );
    expect(comparison.runs.map((run) => run.result.algorithm)).toEqual(['guillotine', 'shelf']);
  });
});

describe('رجیستری الگوریتم‌ها', () => {
  it('پنج الگوریتم ثبت شده است و شناسه‌ها یکتا هستند', () => {
    const ids = ALGORITHMS.map((algorithm) => algorithm.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['guillotine', 'maxrects', 'skyline', 'shelf', 'optimizer']));
  });

  it('هر الگوریتم دست‌کم یک زیرگزینهٔ فارسی دارد', () => {
    for (const algorithm of ALGORITHMS) {
      expect(algorithm.variants.length).toBeGreaterThan(0);
      for (const variant of algorithm.variants) {
        expect(variant.label.length).toBeGreaterThan(2);
        expect(variant.value).toBeTruthy();
      }
    }
  });

  it('انتخاب نامعتبر ذخیره‌شده به پیش‌فرض گیلوتینی برمی‌گردد', () => {
    expect(normalizeSelection({ id: 'nope', variant: 'nope' }).id).toBe('guillotine');
    expect(normalizeSelection(undefined)).toEqual({ id: 'guillotine', variant: 'best-area-fit' });
    expect(normalizeSelection({ id: 'skyline', variant: 'nonsense' })).toEqual({
      id: 'skyline',
      variant: defaultVariantFor('skyline'),
    });
    expect(normalizeSelection({ id: 'optimizer', variant: 'sa-maxrects', iterations: 12.9, seed: 3.7 })).toEqual({
      id: 'optimizer',
      variant: 'sa-maxrects',
      iterations: 12,
      seed: 3,
    });
  });
});

describe('بنچمارک مقایسه‌ای (تشخیص رگرسیون)', () => {
  /**
   * اعداد مبنا از اجرای الگوریتم‌ها روی پروندهٔ ثابت به‌دست آمده‌اند.
   * هدف: اگر روزی تغییری باعث بدترشدن شدید چیدمان شود، این تست قرمز شود.
   */
  it('تعداد ورق هر الگوریتم از سقف مبنای خود بیشتر نشود', () => {
    const parts = benchmarkDataset();
    const stock = { length: 3660, width: 1830 };
    const limits: Record<string, number> = {
      guillotine: 10,
      maxrects: 10,
      skyline: 12,
      shelf: 14,
      optimizer: 10,
    };
    for (const algorithm of ALGORITHMS) {
      const { result } = runLayout({
        parts,
        stock,
        options: BASE,
        selection: {
          id: algorithm.id,
          variant: algorithm.variants[0].value,
          iterations: algorithm.id === 'optimizer' ? 25 : undefined,
          seed: 2024,
        },
      });
      expect(result.summary.unplacedCount, `${algorithm.id} قطعهٔ جا‌نشده دارد`).toBe(0);
      expect(result.summary.sheetCount, `${algorithm.id} بدتر از مبنای خود شد`).toBeLessThanOrEqual(
        limits[algorithm.id],
      );
    }
  });

  it('متریک‌های هر اجرا موجود و معقول است', () => {
    for (const { result } of runAllVariants(benchmarkDataset())) {
      expect(result.metrics).toBeDefined();
      expect(result.metrics!.cutLength).toBeGreaterThan(0);
      expect(result.metrics!.cutCount).toBeGreaterThan(0);
      expect(result.metrics!.elapsedMs).toBeGreaterThanOrEqual(0);
      expect(result.metrics!.algorithm).toBe(result.algorithm);
    }
  });
});
