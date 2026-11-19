import { describe, expect, it } from 'vitest';
import { computePartsStats } from '../lib/stats';
import { logger, LOG_BUFFER_LIMIT } from '../lib/logger';
import { DEFAULT_PACKING_SETTINGS } from '../storage/packingSettings';
import { normalizeSelection } from '../engine/registry';
import { createPart } from '../types/part';
import { fa } from '../i18n/fa';
import {
  DEFAULT_ALGORITHM_ID,
  DXF_SHEET_GAP_MM,
  GROOVE_INSET_MM,
  MAX_OPTIMIZER_ITERATIONS,
} from '../config/constants';

describe('خلاصهٔ آماری قطعات', () => {
  it('ردیف‌های ناقص و بدون ابعاد در جمع لحاظ نمی‌شوند', () => {
    const rows = [
      createPart({ name: 'الف', length: 1000, width: 500, qty: 2, bandLength: 2 }),
      createPart({ name: 'ناقص', length: 1000, width: 0, qty: 2 }),
      createPart(), // ردیف کاملاً خالی: ناقص حساب نمی‌شود
    ];
    const stats = computePartsStats(rows, 0);
    expect(stats.rowCount).toBe(1);
    expect(stats.totalQty).toBe(2);
    expect(stats.totalAreaM2).toBeCloseTo(1, 5); // 1000×500×2 = 1 m²
    expect(stats.bandMeters).toBe(4); // ۲ لبه × ۱۰۰۰ × ۲ قطعه = ۴ متر
    expect(stats.incomplete).toBe(1);
  });

  it('تعداد کسری و ابعاد نامعتبر گزارش می‌شوند', () => {
    const stats = computePartsStats(
      [
        createPart({ length: 100, width: 100, qty: 2.5 }),
        createPart({ length: -50, width: 100, qty: 1 }),
      ],
      0,
    );
    expect(stats.fractional).toBe(1);
    expect(stats.invalid).toBe(1);
  });

  it('ضخامت نوار مساحت برش را کم می‌کند', () => {
    const rows = [createPart({ length: 1000, width: 1000, qty: 1, bandLength: 2, bandWidth: 2 })];
    const withoutBand = computePartsStats(rows, 0);
    const withBand = computePartsStats(rows, 10);
    expect(withBand.totalAreaM2).toBeLessThan(withoutBand.totalAreaM2);
  });
});

describe('لاگر متمرکز', () => {
  it('رکوردها نگه داشته می‌شوند و بافر محدود است', () => {
    logger.clear();
    logger.info('پیام تست');
    expect(logger.getRecords().some((record) => record.message === 'پیام تست')).toBe(true);

    for (let i = 0; i < LOG_BUFFER_LIMIT + 50; i++) logger.debug(`ردیف ${i}`);
    expect(logger.getRecords().length).toBe(LOG_BUFFER_LIMIT);
    logger.clear();
  });

  it('خطا با جزئیات سریالایز می‌شود و اشتراک‌کننده خبردار می‌شود', () => {
    logger.clear();
    let notified = 0;
    const unsubscribe = logger.subscribe(() => {
      notified += 1;
    });
    logger.error('خطای آزمایشی', new Error('boom'));
    const last = logger.getRecords().at(-1);
    expect(last?.level).toBe('error');
    expect(last?.detail).toContain('boom');
    expect(notified).toBeGreaterThan(0);
    unsubscribe();
    logger.clear();
  });
});

describe('پیش‌فرض‌ها و ثابت‌ها', () => {
  it('الگوریتم پیش‌فرض گیلوتینی است (سازگاری با نسخهٔ قبل)', () => {
    expect(DEFAULT_ALGORITHM_ID).toBe('guillotine');
    expect(DEFAULT_PACKING_SETTINGS.selection.id).toBe('guillotine');
    expect(normalizeSelection(undefined).id).toBe('guillotine');
  });

  it('ثابت‌های کارگاهی مقدار معقول دارند', () => {
    expect(GROOVE_INSET_MM).toBeGreaterThan(0);
    expect(DXF_SHEET_GAP_MM).toBeGreaterThan(0);
    expect(MAX_OPTIMIZER_ITERATIONS).toBeGreaterThan(100);
  });

  it('رشته‌های فارسی ناوبری پنج زبانه را کامل پوشش می‌دهند', () => {
    expect(Object.keys(fa.nav)).toEqual(
      expect.arrayContaining(['dashboard', 'parts', 'map', 'results', 'more']),
    );
    for (const key of ['dashboard', 'parts', 'map', 'results', 'more'] as const) {
      expect(fa.nav[key].length).toBeGreaterThan(1);
    }
  });
});
