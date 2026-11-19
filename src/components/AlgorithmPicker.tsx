import { useMemo } from 'react';
import { ALGORITHMS, variantLabel, type AlgorithmId, type AlgorithmSelection, type AlgorithmVariant } from '../algorithm';
import {
  DEFAULT_OPTIMIZER_ITERATIONS,
  DEFAULT_OPTIMIZER_SEED,
  MAX_OPTIMIZER_ITERATIONS,
} from '../config/constants';

/**
 * A-Cut 2Dpro — انتخابگر الگوریتم چیدمان
 * =====================================
 * - کارت‌های بزرگ برای انتخاب الگوریتم (گیلوتینی، MaxRects، Skyline، Shelf، بهینه‌ساز)
 * - لیست زیرگزینه‌های همان الگوریتم (هیوریستیک/قانون تقسیم) به فارسی
 * - برای بهینه‌ساز: بذر و تعداد تکرار (بازتولیدپذیری نتایج)
 * - نمایش «الگوریتم فعال» به‌صورت خلاصه تا در هر صفحه مشخص باشد
 *
 * انتخاب با هر تغییر ذخیره می‌شود (localStorage — در App) و بین رفرش‌ها
 * و صفحه‌ها باقی می‌ماند.
 */

interface AlgorithmPickerProps {
  selection: AlgorithmSelection;
  onChange: (selection: AlgorithmSelection) => void;
  /** فشرده: نسخهٔ کوچک برای صفحه‌های داخلی */
  compact?: boolean;
  /** سقف ورق (۰ = نامحدود) */
  maxSheets: number;
  onMaxSheetsChange: (value: number) => void;
  disabled?: boolean;
}

export default function AlgorithmPicker({
  selection,
  onChange,
  compact = false,
  maxSheets,
  onMaxSheetsChange,
  disabled = false,
}: AlgorithmPickerProps) {
  const active = useMemo(
    () => ALGORITHMS.find((algorithm) => algorithm.id === selection.id) ?? ALGORITHMS[0],
    [selection.id],
  );

  const selectAlgorithm = (id: AlgorithmId) => {
    const algorithm = ALGORITHMS.find((candidate) => candidate.id === id) ?? ALGORITHMS[0];
    onChange({
      ...selection,
      id,
      variant: algorithm.variants[0].value,
    });
  };

  return (
    <section className="panel p-4 sm:p-5" aria-labelledby="algorithm-title">
      <div className="flex flex-wrap items-start gap-2">
        <div>
          <span className="badge mb-2">الگوریتم چیدمان</span>
          <h2 id="algorithm-title" className="panel-title">
            روش چیدمان را انتخاب کنید
          </h2>
          <p className="mt-1 max-w-3xl text-sm font-semibold leading-7 text-muted">
            گیلوتینی برای ارهٔ پانل‌بُر (برش‌های سرتاسری) است؛ MaxRects و Skyline پرت کمتری
            دارند ولی ممکن است خط برش شکسته لازم شود (مناسب CNC). Shelf ساده‌ترین و
            بهینه‌ساز کندترین/دقیق‌ترین حالت است.
          </p>
        </div>
        <span className="badge ms-auto border-emerald-400/70 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200">
          فعال: {active.label}
          {!compact && ` · ${variantLabel(selection.id, selection.variant)}`}
        </span>
      </div>

      {/* کارت‌های انتخاب الگوریتم */}
      <div
        className={`mt-4 grid gap-2 ${compact ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2 xl:grid-cols-5'}`}
        role="radiogroup"
        aria-label="الگوریتم چیدمان"
      >
        {ALGORITHMS.map((algorithm) => {
          const isActive = algorithm.id === selection.id;
          return (
            <button
              key={algorithm.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              disabled={disabled}
              onClick={() => selectAlgorithm(algorithm.id)}
              className={`flex h-full flex-col items-start gap-1 rounded-xl border-2 p-3 text-start transition ${
                isActive
                  ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_14%,var(--surface-2))]'
                  : 'border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--accent)]'
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <span className="flex w-full items-center gap-1.5">
                <span className="text-base font-black text-[var(--text)]">{algorithm.label}</span>
                {algorithm.slow && (
                  <span className="ms-auto rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-black text-amber-800 dark:text-amber-200">
                    کند
                  </span>
                )}
                {isActive && (
                  <span className="ms-auto rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-black text-white dark:text-slate-950">
                    فعال
                  </span>
                )}
              </span>
              <span className="text-[11px] font-semibold leading-5 text-muted">{algorithm.description}</span>
            </button>
          );
        })}
      </div>

      {/* زیرگزینه‌ها + تنظیمات بهینه‌ساز */}
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <label className="block">
          <span className="field-label">تنظیم دقیق روش «{active.label}»</span>
          <select
            className="field-select"
            value={selection.variant}
            disabled={disabled}
            onChange={(event) =>
              onChange({ ...selection, variant: event.target.value as AlgorithmVariant })
            }
          >
            {active.variants.map((variant) => (
              <option key={variant.value} value={variant.value}>
                {variant.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="field-label">
            سقف تعداد ورق موجود
            <span className="text-xs font-bold text-subtle">۰ = نامحدود</span>
          </span>
          <input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            dir="ltr"
            className="field-input"
            value={maxSheets}
            disabled={disabled}
            onChange={(event) => {
              const value = Number(event.target.value);
              onMaxSheetsChange(Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);
            }}
          />
        </label>

        {selection.id === 'optimizer' && (
          <>
            <label className="block">
              <span className="field-label">
                تعداد تکرار بهینه‌سازی
                <span className="text-xs font-bold text-subtle">
                  حداکثر {MAX_OPTIMIZER_ITERATIONS.toLocaleString('fa-IR')}
                </span>
              </span>
              <input
                type="number"
                min={1}
                max={MAX_OPTIMIZER_ITERATIONS}
                step={10}
                dir="ltr"
                className="field-input"
                value={selection.iterations ?? DEFAULT_OPTIMIZER_ITERATIONS}
                disabled={disabled}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (!Number.isFinite(value)) return;
                  onChange({
                    ...selection,
                    iterations: Math.min(MAX_OPTIMIZER_ITERATIONS, Math.max(1, Math.floor(value))),
                  });
                }}
              />
            </label>
            <label className="block">
              <span className="field-label">
                بذر تصادفی (Seed)
                <span className="text-xs font-bold text-subtle">برای نتیجهٔ تکرارپذیر</span>
              </span>
              <div className="flex gap-2">
                <input
                  type="number"
                  step={1}
                  dir="ltr"
                  className="field-input"
                  value={selection.seed ?? DEFAULT_OPTIMIZER_SEED}
                  disabled={disabled}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (!Number.isFinite(value)) return;
                    onChange({ ...selection, seed: Math.floor(value) });
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secondary shrink-0"
                  disabled={disabled}
                  onClick={() =>
                    onChange({
                      ...selection,
                      seed: Math.floor(Math.random() * 1_000_000),
                    })
                  }
                  title="بذر تصادفی تازه — جستجوی دیگری را امتحان می‌کند"
                >
                  🎲 بذر تازه
                </button>
              </div>
            </label>
          </>
        )}
      </div>
    </section>
  );
}
