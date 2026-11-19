import { describe, expect, it } from 'vitest';
import { validateLayoutInput, isValidLayoutInput } from '../shared';
import { calculateLayout } from '../../algorithm';
import { checkInvariants, part } from './invariants';

const STOCK = { length: 2440, width: 1220 };

describe('اعتبارسنجی ورودی چیدمان', () => {
  it('ورودی سالم هیچ خطایی ندارد', () => {
    const report = validateLayoutInput({
      parts: [part({ id: 'a', length: 500, width: 300, qty: 2 })],
      stock: STOCK,
      options: { kerf: 4, bandThickness: 0, allowRotation: true, maxSheets: 0 },
    });
    expect(report.ok).toBe(true);
    expect(report.issues).toHaveLength(0);
    expect(isValidLayoutInput({ parts: [], stock: STOCK })).toBe(true);
  });

  it.each([
    ['طول صفر', { length: 0, width: 1220 }],
    ['عرض صفر', { length: 2440, width: 0 }],
    ['طول منفی', { length: -100, width: 1220 }],
    ['عرض NaN', { length: 2440, width: Number.NaN }],
    ['عرض بی‌نهایت', { length: 2440, width: Number.POSITIVE_INFINITY }],
  ])('ابعاد ورق نامعتبر (%s) ⇒ خطای INVALID_STOCK', (_label, stock) => {
    const report = validateLayoutInput({ parts: [part({ id: 'a' })], stock });
    expect(report.ok).toBe(false);
    expect(report.issues.some((issue) => issue.code === 'INVALID_STOCK')).toBe(true);
  });

  it('kerf منفی خطاست، kerf صفر مجاز است', () => {
    const negative = validateLayoutInput({ parts: [], stock: STOCK, options: { kerf: -2 } });
    expect(negative.issues.some((issue) => issue.code === 'INVALID_KERF')).toBe(true);
    const zero = validateLayoutInput({ parts: [], stock: STOCK, options: { kerf: 0 } });
    expect(zero.ok).toBe(true);
  });

  it('ضخامت نوار منفی و سقف ورق نامعتبر خطا هستند', () => {
    const bad = validateLayoutInput({
      parts: [],
      stock: STOCK,
      options: { bandThickness: -1, maxSheets: -5 },
    });
    const codes = bad.issues.map((issue) => issue.code);
    expect(codes).toContain('INVALID_BAND_THICKNESS');
    expect(codes).toContain('INVALID_MAX_SHEETS');
  });

  it('تعداد منفی خطا، تعداد کسری هشدار، تعداد صفر بی‌صدا', () => {
    const report = validateLayoutInput({
      parts: [
        part({ id: 'neg', qty: -3 }),
        part({ id: 'frac', qty: 1.5 }),
        part({ id: 'zero', qty: 0 }),
      ],
      stock: STOCK,
    });
    const byCode = (code: string) => report.issues.filter((issue) => issue.code === code);
    expect(byCode('INVALID_QTY')).toHaveLength(1);
    expect(byCode('FRACTIONAL_QTY')).toHaveLength(1);
    // تعداد صفر خطا نیست (ردیف ناقص، فقط نادیده گرفته می‌شود)
    expect(report.ok).toBe(false);
  });

  it('ردیف با یک بُعد صفر به‌عنوان ناقص گزارش می‌شود ولی محاسبه را متوقف نمی‌کند', () => {
    const report = validateLayoutInput({
      parts: [part({ id: 'half', length: 500, width: 0 })],
      stock: STOCK,
    });
    expect(report.ok).toBe(true);
    expect(report.issues.some((issue) => issue.code === 'EMPTY_PART_DIMENSIONS')).toBe(true);
  });

  it('ابعاد منفی قطعه خطای مسدودکننده است', () => {
    const report = validateLayoutInput({
      parts: [part({ id: 'neg', length: -10, width: 100 })],
      stock: STOCK,
    });
    expect(report.ok).toBe(false);
    expect(report.issues.some((issue) => issue.code === 'NEGATIVE_DIMENSIONS')).toBe(true);
  });

  it('قطعه‌ای که پس از کسر نوار صفر می‌شود خطا می‌گیرد', () => {
    const report = validateLayoutInput({
      parts: [{ id: 'thin', length: 100, width: 4, qty: 1, bandLength: 2, bandWidth: 0 }],
      stock: STOCK,
      options: { bandThickness: 4 },
    });
    expect(report.issues.some((issue) => issue.code === 'PART_TOO_SMALL_AFTER_BAND')).toBe(true);
  });

  it('ورودی نامعتبر هرگز به الگوریتم نمی‌رسد (نتیجهٔ خالی، بدون استثنا)', () => {
    const result = calculateLayout([part({ id: 'a' })], { length: -1, width: -1 }, { kerf: 4 });
    expect(result.placements).toEqual([]);
    expect(result.sheets).toEqual([]);
    expect(result.summary.sheetCount).toBe(0);
  });

  it('maxSheets نامعتبر به صفر (نامحدود) پاک‌سازی می‌شود', () => {
    const unlimited = calculateLayout(
      [part({ id: 'tile', length: 500, width: 500, qty: 9 })],
      { length: 1000, width: 1000 },
      { kerf: 0, maxSheets: -3 },
    );
    expect(unlimited.summary.sheetCount).toBeGreaterThan(1);
    checkInvariants(unlimited, { expectAllPlaced: true });
  });
});
