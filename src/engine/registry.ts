/**
 * A-Cut 2Dpro — ثبت‌کنندهٔ الگوریتم‌ها
 * ===================================
 * افزودن الگوریتم جدید فقط دو کار دارد:
 *   ۱) پیاده‌سازی رابط `PackingAlgorithm` در یک فایل جدید
 *   ۲) افزودن آن به `ALGORITHMS` در همین فایل
 * بقیهٔ برنامه (رابط، مقایسه، ذخیره‌سازی) به‌طور خودکار آن را می‌بیند.
 */
import { DEFAULT_ALGORITHM_ID } from '../config/constants';
import { guillotineAlgorithm } from './guillotine';
import { maxRectsAlgorithm } from './maxrects';
import { skylineAlgorithm } from './skyline';
import { shelfAlgorithm } from './shelf';
import { optimizerAlgorithm } from './optimizer';
import type { AlgorithmId, AlgorithmSelection, AlgorithmVariant, PackingAlgorithm } from './types';

/** فهرست رسمی الگوریتم‌ها — ترتیب همین لیست، ترتیب نمایش در رابط است */
export const ALGORITHMS: readonly PackingAlgorithm[] = [
  guillotineAlgorithm,
  maxRectsAlgorithm,
  skylineAlgorithm,
  shelfAlgorithm,
  optimizerAlgorithm,
];

const BY_ID = new Map<AlgorithmId, PackingAlgorithm>(ALGORITHMS.map((algo) => [algo.id, algo]));

export function getAlgorithm(id: AlgorithmId): PackingAlgorithm {
  return BY_ID.get(id) ?? guillotineAlgorithm;
}

export function isKnownAlgorithmId(id: unknown): id is AlgorithmId {
  return typeof id === 'string' && BY_ID.has(id as AlgorithmId);
}

/** گزینهٔ پیش‌فرض هر الگوریتم (نخستین زیرگزینه) */
export function defaultVariantFor(id: AlgorithmId): AlgorithmVariant {
  return getAlgorithm(id).variants[0].value;
}

/** آیا این زیرگزینه متعلق به همین الگوریتم است؟ */
export function isValidVariant(id: AlgorithmId, variant: unknown): variant is AlgorithmVariant {
  return getAlgorithm(id).variants.some((option) => option.value === variant);
}

/** انتخاب پیش‌فرض (گیلوتینی — سازگار با نسخه‌های قبلی) */
export const DEFAULT_SELECTION: AlgorithmSelection = {
  id: DEFAULT_ALGORITHM_ID,
  variant: defaultVariantFor(DEFAULT_ALGORITHM_ID),
};

/** نام فارسی زیرگزینهٔ فعال (برای نمایش «الگوریتم فعال») */
export function variantLabel(id: AlgorithmId, variant: AlgorithmVariant): string {
  return getAlgorithm(id).variants.find((option) => option.value === variant)?.label ?? variant;
}

/**
 * پاک‌سازی انتخاب ذخیره‌شده (از localStorage یا فایل پروژه) —
 * مقدار نامعتبر به پیش‌فرض برمی‌گردد تا برنامه هرگز با انتخاب خراب بالا نیاید.
 */
export function normalizeSelection(raw: unknown): AlgorithmSelection {
  const candidate = (raw ?? {}) as Partial<AlgorithmSelection>;
  const id = isKnownAlgorithmId(candidate.id) ? candidate.id : DEFAULT_SELECTION.id;
  const variant = isValidVariant(id, candidate.variant)
    ? candidate.variant
    : defaultVariantFor(id);
  const selection: AlgorithmSelection = { id, variant };
  if (typeof candidate.iterations === 'number' && Number.isFinite(candidate.iterations)) {
    selection.iterations = Math.max(1, Math.floor(candidate.iterations));
  }
  if (typeof candidate.seed === 'number' && Number.isFinite(candidate.seed)) {
    selection.seed = Math.floor(candidate.seed);
  }
  return selection;
}
