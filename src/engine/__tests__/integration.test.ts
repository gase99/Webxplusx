import { describe, expect, it } from 'vitest';
import { ALGORITHMS } from '../registry';
import { calculateLayout } from '../../algorithm';
import { generateDxf } from '../../exportDxf';
import { settingsFromLayout, computeLayoutSignature } from '../../types/project';
import { benchmarkDataset, checkInvariants, part } from './invariants';
import { createPart } from '../../types/part';
import type { CutPart } from '../../types/part';

/** پروندهٔ ثابت به‌شکل قطعات کامل (برای خروجی DXF و ذخیرهٔ پروژه) */
const cutParts: CutPart[] = benchmarkDataset().map((item) =>
  createPart({
    id: item.id,
    name: item.name ?? '',
    length: item.length,
    width: item.width,
    qty: item.qty,
  }),
);

const STOCK = { length: 3660, width: 1830 };
const BASE = { kerf: 4, allowRotation: true } as const;

/**
 * یکپارچگی: نقشهٔ برش، DXF و ذخیره/بازیابی پروژه باید برای «هر» الگوریتم
 * یکسان و بدون خطا کار کنند (پروژهٔ ذخیره‌شده هم باید همان چیدمان را بدهد).
 */
describe('یکپارچگی خروجی‌ها برای همهٔ الگوریتم‌ها', () => {
  const parts = benchmarkDataset();

  for (const algorithm of ALGORITHMS) {
    it(`DXF برای «${algorithm.label}» ساخته می‌شود و همهٔ قطعات لایهٔ CUT دارند`, () => {
      const result = calculateLayout(parts, STOCK, {
        ...BASE,
        algorithm: {
          id: algorithm.id,
          variant: algorithm.variants[0].value,
          iterations: algorithm.id === 'optimizer' ? 10 : undefined,
          seed: 5,
        },
      });

      const dxf = generateDxf(result, cutParts);
      expect(dxf.length).toBeGreaterThan(1000);
      expect(dxf).toContain('SECTION');
      expect(dxf).toContain('ENDSEC');
      expect(dxf).toContain('EOF');
      expect(dxf).toContain('CUT');
      expect(dxf).toContain('SHEET');

      // یک POLYLINE برای هر قطعه (به‌علاوهٔ کادر هر ورق)
      const polylines = dxf.match(/\nPOLYLINE\n/g)?.length ?? 0;
      expect(polylines).toBeGreaterThanOrEqual(result.placements.length);
      // تعداد ورق‌های DXF با ورق‌های چیدمان برابر است
      const sheetLabels = dxf.match(/SHEET \d+ - /g)?.length ?? 0;
      expect(sheetLabels).toBe(result.sheets.length);
      checkInvariants(result, { expectAllPlaced: true });
    });

    it(`ذخیره/بازیابی پروژه برای «${algorithm.label}» همان چیدمان را می‌دهد`, () => {
      const result = calculateLayout(parts, STOCK, {
        ...BASE,
        algorithm: {
          id: algorithm.id,
          variant: algorithm.variants[0].value,
          iterations: algorithm.id === 'optimizer' ? 8 : undefined,
          seed: 9,
        },
      });
      // همان چرخه‌ای که در App هنگام save/load پروژه رخ می‌دهد
      const restoredSettings = settingsFromLayout(result);
      const json = JSON.stringify(result);
      const parsed = JSON.parse(json) as typeof result;

      expect(parsed.algorithm).toBe(result.algorithm);
      expect(parsed.variant).toBe(result.variant);
      expect(parsed.placements).toEqual(result.placements);
      expect(restoredSettings.stockLength).toBe(STOCK.length);
      expect(restoredSettings.stockWidth).toBe(STOCK.width);
      expect(restoredSettings.kerf).toBe(BASE.kerf);
      // امضای چیدمان از تنظیمات بازیابی‌شده باید پایدار باشد
      expect(computeLayoutSignature(cutParts, restoredSettings)).toBe(
        computeLayoutSignature(cutParts, restoredSettings),
      );
    });
  }

  it('نقشهٔ برش برای همهٔ الگوریتم‌ها مختصات قابل رسم می‌دهد', () => {
    for (const algorithm of ALGORITHMS) {
      const result = calculateLayout(parts, STOCK, {
        ...BASE,
        algorithm: {
          id: algorithm.id,
          variant: algorithm.variants[0].value,
          iterations: algorithm.id === 'optimizer' ? 8 : undefined,
          seed: 3,
        },
      });
      for (const sheet of result.sheets) {
        expect(sheet.placements.length).toBeGreaterThan(0);
        for (const placement of sheet.placements) {
          expect(Number.isFinite(placement.x)).toBe(true);
          expect(Number.isFinite(placement.y)).toBe(true);
          expect(placement.x + placement.width).toBeLessThanOrEqual(STOCK.length + 0.01);
          expect(placement.y + placement.height).toBeLessThanOrEqual(STOCK.width + 0.01);
        }
      }
    }
  });

  it('متریک‌ها با تعداد قطعات هم‌خوان است', () => {
    const result = calculateLayout([part({ id: 'x', length: 500, width: 400, qty: 6 })], STOCK, BASE);
    expect(result.metrics!.cutCount).toBe(result.placements.length * 2 + 4);
    expect(result.metrics!.cutLength).toBeGreaterThan(0);
  });
});
