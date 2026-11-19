/**
 * A-Cut 2Dpro — نقطهٔ ورود موتور چیدمان چندالگوریتمی
 * ==================================================
 * API پایدار برای بقیهٔ برنامه:
 *
 * ```ts
 * const result = runLayout({ parts, stock, options, selection });
 * const { best, runs } = compareAlgorithms({ parts, stock, options }, ids);
 * ```
 *
 * `calculateLayout` نیز با همان امضای نسخه‌های قبلی نگه داشته شده تا کد و
 * پروژه‌های قدیمی بدون تغییر کار کنند (پیش‌فرض: گیلوتینی).
 */
import { DEFAULT_MAX_SHEETS } from '../config/constants';
import { logger } from '../lib/logger';
import {
  expandInstances,
  finalizeResult,
  validateLayoutInput,
  type ValidationIssue,
  type ValidationReport,
} from './shared';
import { getAlgorithm, normalizeSelection, DEFAULT_SELECTION, ALGORITHMS } from './registry';
import type {
  AlgorithmId,
  AlgorithmSelection,
  LayoutOptions,
  LayoutPartInput,
  LayoutResult,
  PackingContext,
  PackingOutcome,
  StockSheet,
} from './types';

export * from './types';
export { ALGORITHMS, getAlgorithm, variantLabel, normalizeSelection, DEFAULT_SELECTION, defaultVariantFor } from './registry';
export {
  validateLayoutInput,
  isValidLayoutInput,
  expandInstances,
  computeMetrics,
  type ValidationIssue,
  type ValidationReport,
} from './shared';
export { scoreOutcome, createRandom } from './optimizer';

export interface RunLayoutInput {
  parts: readonly LayoutPartInput[];
  stock: StockSheet;
  options?: Partial<LayoutOptions>;
  /** انتخاب الگوریتم؛ پیش‌فرض گیلوتینی */
  selection?: AlgorithmSelection;
}

export interface RunLayoutOutput {
  result: LayoutResult;
  report: ValidationReport;
}

/** ساخت زمینهٔ اجرای الگوریتم از ورودی خام */
function buildContext(input: RunLayoutInput): { context: PackingContext; report: ValidationReport } {
  const options = input.options ?? {};
  const kerf = Math.max(0, Number(options.kerf) || 0);
  const bandThickness = Math.max(0, Number(options.bandThickness) || 0);
  const allowRotation = options.allowRotation ?? true;
  const maxSheets = Math.max(0, Number(options.maxSheets ?? DEFAULT_MAX_SHEETS) || 0);
  const selection = normalizeSelection(input.selection ?? options.algorithm ?? DEFAULT_SELECTION);

  const report = validateLayoutInput({ parts: input.parts, stock: input.stock, options: { ...options, kerf, bandThickness, maxSheets } });

  // ابعاد ورق نامعتبر ⇒ بدون اجرای الگوریتم، نتیجهٔ خالی برمی‌گردانیم
  const stock: StockSheet = {
    length: Number.isFinite(input.stock?.length) && input.stock.length > 0 ? input.stock.length : 0,
    width: Number.isFinite(input.stock?.width) && input.stock.width > 0 ? input.stock.width : 0,
  };

  const context: PackingContext = {
    instances: report.ok ? expandInstances(input.parts, bandThickness) : [],
    stock,
    kerf,
    allowRotation,
    maxSheets,
    selection,
    onProgress: options.onProgress,
    signal: options.signal,
  };
  return { context, report };
}

/** اجرای یک الگوریتم با ورودی خام و ساخت نتیجهٔ کامل */
export function runLayout(input: RunLayoutInput): RunLayoutOutput {
  const startedAt = performance.now();
  const options = input.options ?? {};
  const { context, report } = buildContext(input);

  if (!report.ok) {
    // ورودی نامعتبر: نتیجهٔ خالی + گزارش؛ هیچ استثنایی پرتاب نمی‌شود تا UI کنترل کامل داشته باشد.
    for (const issue of report.issues) {
      if (issue.code === 'INVALID_STOCK') logger.warn('ورودی نامعتبر: ابعاد ورق', issue.message);
    }
  }

  const algorithm = getAlgorithm(context.selection.id);
  let outcome: PackingOutcome = { sheets: [], placements: [], unplaced: [] };
  if (report.ok && context.instances.length > 0) {
    try {
      outcome = algorithm.run(context);
    } catch (error) {
      logger.error(`اجرای الگوریتم «${algorithm.label}» ناموفق بود`, error);
      throw error;
    }
  }

  const result = finalizeResult({
    context,
    outcome,
    startedAt,
    stock: context.stock,
    kerf: context.kerf,
    bandThickness: Math.max(0, Number(options.bandThickness) || 0),
    sheetColor: options.sheetColor,
    bandColor: options.bandColor,
  });

  return { result, report };
}

/* ------------------------------------------------------------------ */
/*  مقایسهٔ الگوریتم‌ها                                                 */
/* ------------------------------------------------------------------ */

export interface AlgorithmRun {
  selection: AlgorithmSelection;
  label: string;
  result: LayoutResult;
  /** خطای اجرا (در صورت وجود) */
  error?: string;
}

export interface ComparisonOutput {
  runs: AlgorithmRun[];
  /** بهترین نتیجه بر اساس کمترین تعداد ورق */
  bestBySheets: AlgorithmRun | null;
  /** بهترین نتیجه بر اساس کمترین پرت */
  bestByWaste: AlgorithmRun | null;
  issues: ValidationIssue[];
}

/**
 * اجرای چند الگوریتم روی یک ورودی و مقایسهٔ نتیجه‌ها.
 * پیش‌فرض: همهٔ الگوریتم‌های ثبت‌شده با انتخاب‌های فعلی کاربر.
 * انتخاب «بهینه‌ساز» برای مقایسه با تعداد تکرار کمتر اجرا می‌شود تا منتظر نمانیم.
 */
export function compareAlgorithms(
  input: RunLayoutInput,
  selections?: AlgorithmSelection[],
): ComparisonOutput {
  const base = normalizeSelection(input.selection ?? DEFAULT_SELECTION);
  const targets: AlgorithmSelection[] =
    selections && selections.length > 0
      ? selections.map((selection) => normalizeSelection(selection))
      : ALGORITHMS.map((algorithm) => ({
          ...base,
          id: algorithm.id,
          variant: algorithm.id === base.id ? base.variant : algorithm.variants[0].value,
        }));

  const runs: AlgorithmRun[] = [];
  let issues: ValidationIssue[] = [];

  for (const selection of targets) {
    const algorithm = getAlgorithm(selection.id);
    try {
      const { result, report } = runLayout({ ...input, selection });
      issues = report.issues;
      runs.push({ selection, label: algorithm.label, result });
    } catch (error) {
      runs.push({
        selection,
        label: algorithm.label,
        result: emptyResult(input, selection),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const success = runs.filter((run) => !run.error);
  const bestBySheets = success.reduce<AlgorithmRun | null>((best, run) => {
    if (!best) return run;
    const a = run.result.summary;
    const b = best.result.summary;
    if (a.sheetCount !== b.sheetCount) return a.sheetCount < b.sheetCount ? run : best;
    return a.wasteArea < b.wasteArea ? run : best;
  }, null);
  const bestByWaste = success.reduce<AlgorithmRun | null>((best, run) => {
    if (!best) return run;
    return run.result.summary.wastePercentage < best.result.summary.wastePercentage ? run : best;
  }, null);

  return { runs, bestBySheets, bestByWaste, issues };
}

/** نتیجهٔ خالی برای الگوریتمی که اجرا نشد (تا جدول مقایسه همیشه یک ردیف داشته باشد) */
function emptyResult(input: RunLayoutInput, selection: AlgorithmSelection): LayoutResult {
  const startedAt = performance.now();
  const context: PackingContext = {
    instances: [],
    stock: input.stock,
    kerf: Math.max(0, Number(input.options?.kerf) || 0),
    allowRotation: input.options?.allowRotation ?? true,
    maxSheets: Math.max(0, Number(input.options?.maxSheets) || 0),
    selection,
  };
  return finalizeResult({
    context,
    outcome: { sheets: [], placements: [], unplaced: [] },
    startedAt,
    stock: input.stock,
    kerf: context.kerf,
    bandThickness: Math.max(0, Number(input.options?.bandThickness) || 0),
    sheetColor: input.options?.sheetColor,
    bandColor: input.options?.bandColor,
  });
}

/* ------------------------------------------------------------------ */
/*  سازگاری با نسخه‌های قبلی                                           */
/* ------------------------------------------------------------------ */

/**
 * امضای قدیمی (پیش از چندالگوریتمی) — همان ورودی/خروجی قبلی ولی با موتور
 * جدید. پیش‌فرض گیلوتینی با هیوریستیک «Best Area Fit» است، پس خروجی برای
 * پروژه‌های موجود دقیقاً همان قبلی می‌ماند.
 */
export function calculateLayout(
  parts: LayoutPartInput[],
  stock: StockSheet,
  options: LayoutOptions,
): LayoutResult {
  return runLayout({ parts, stock, options, selection: options.algorithm }).result;
}

/** شناسهٔ الگوریتم‌های قابل انتخاب (برای UI و تست) */
export const AVAILABLE_ALGORITHM_IDS: readonly AlgorithmId[] = ALGORITHMS.map((algorithm) => algorithm.id);
