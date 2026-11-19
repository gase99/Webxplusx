import { useMemo, useState } from 'react';
import { ALGORITHMS, compareAlgorithms, type AlgorithmRun } from '../algorithm';
import { logger } from '../lib/logger';
import type { AlgorithmSelection, LayoutPartInput, StockSheet } from '../algorithm';
import type { LayoutSettings } from '../types/project';

/**
 * A-Cut 2Dpro — مقایسهٔ الگوریتم‌ها
 * ================================
 * با یک کلیک، همهٔ الگوریتم‌ها روی همان ورودی اجرا می‌شوند و جدول مقایسه
 * (تعداد ورق، پرت، بهره‌وری، طول/تعداد برش و زمان اجرا) نمایش داده می‌شود.
 * بهترین نتیجه بر اساس «تعداد ورق» و بر اساس «کمترین پرت» هایلایت می‌شود.
 * با دکمهٔ «استفاده از این نتیجه»، خروجی همان الگوریتم برای نقشه/DXF انتخاب
 * می‌شود تا جریان کاری عوض نشود.
 */

const faNumber = new Intl.NumberFormat('fa-IR');
const faDecimal = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });

interface AlgorithmComparisonProps {
  parts: LayoutPartInput[];
  stock: StockSheet;
  settings: LayoutSettings;
  selection: AlgorithmSelection;
  maxSheets: number;
  /** اجرای الگوریتم انتخابی به‌عنوان نتیجهٔ اصلی */
  onUse: (selection: AlgorithmSelection) => void;
  disabled?: boolean;
}

export default function AlgorithmComparison({
  parts,
  stock,
  settings,
  selection,
  maxSheets,
  onUse,
  disabled = false,
}: AlgorithmComparisonProps) {
  const [runs, setRuns] = useState<AlgorithmRun[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [bestBySheets, setBestBySheets] = useState<string | null>(null);
  const [bestByWaste, setBestByWaste] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canCompare = parts.some((part) => part.length > 0 && part.width > 0 && part.qty > 0);

  const handleCompare = () => {
    if (!canCompare) {
      setError('برای مقایسه، ابتدا قطعات را وارد کنید.');
      return;
    }
    setError(null);
    setBusy(true);
    // یک فریم صبر می‌کنیم تا دکمه حالت «در حال محاسبه» را نشان دهد
    window.setTimeout(() => {
      try {
        const comparison = compareAlgorithms({
          parts,
          stock,
          options: {
            kerf: settings.kerf,
            bandThickness: settings.bandThickness,
            allowRotation: settings.allowRotation,
            sheetColor: settings.sheetColor,
            bandColor: settings.bandColor,
            maxSheets,
          },
          selection,
        });
        setRuns(comparison.runs);
        setBestBySheets(comparison.bestBySheets?.selection.id ?? null);
        setBestByWaste(comparison.bestByWaste?.selection.id ?? null);
        if (comparison.runs.every((run) => run.error)) {
          setError('اجرای مقایسه ناموفق بود؛ تنظیمات ورق و قطعات را بررسی کنید.');
        }
      } catch (caught) {
        logger.error('مقایسهٔ الگوریتم‌ها ناموفق بود', caught);
        setError('مقایسه انجام نشد؛ دوباره تلاش کنید.');
      } finally {
        setBusy(false);
      }
    }, 16);
  };

  const rows = useMemo(() => runs ?? [], [runs]);

  return (
    <section className="panel p-4 sm:p-5" aria-labelledby="compare-title">
      <div className="flex flex-wrap items-start gap-2">
        <div>
          <span className="badge mb-2">مقایسه</span>
          <h2 id="compare-title" className="panel-title">
            مقایسهٔ الگوریتم‌ها روی همین ورودی
          </h2>
          <p className="mt-1 max-w-3xl text-sm font-semibold leading-7 text-muted">
            همهٔ روش‌ها یک‌بار روی همین قطعات و ورق اجرا می‌شوند؛ جدول زیر تعداد ورق، پرت،
            طول برش و زمان اجرا را نشان می‌دهد. با «انتخاب این روش» همان نتیجه مبنای نقشه و
            خروجی‌ها می‌شود.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary ms-auto"
          onClick={handleCompare}
          disabled={busy || disabled}
        >
          {busy ? '⏳ در حال مقایسه…' : '⚖️ مقایسهٔ الگوریتم‌ها'}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-xl border-2 border-amber-400/70 bg-amber-500/12 px-3 py-2 text-sm font-bold text-amber-800 dark:text-amber-200">
          ⚠ {error}
        </p>
      )}

      {rows.length > 0 && (
        <div className="table-scroll mt-4 overflow-x-auto rounded-xl border-2 border-[var(--border)]">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <caption className="sr-only">مقایسهٔ نتیجهٔ الگوریتم‌های چیدمان</caption>
            <thead>
              <tr className="bg-[var(--surface-3)] text-[var(--text)]">
                <th scope="col" className="p-2 text-start font-black">الگوریتم</th>
                <th scope="col" className="p-2 font-black">ورق</th>
                <th scope="col" className="p-2 font-black">پرت٪</th>
                <th scope="col" className="p-2 font-black">بهره‌وری٪</th>
                <th scope="col" className="p-2 font-black">جا نشد</th>
                <th scope="col" className="p-2 font-black">طول برش (m)</th>
                <th scope="col" className="p-2 font-black">برش</th>
                <th scope="col" className="p-2 font-black">زمان (ms)</th>
                <th scope="col" className="p-2 font-black">انتخاب</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((run) => {
                const summary = run.result.summary;
                const isBestSheets = bestBySheets === run.selection.id;
                const isBestWaste = bestByWaste === run.selection.id;
                const isCurrent = selection.id === run.selection.id;
                return (
                  <tr
                    key={run.selection.id}
                    className={`border-t-2 border-[var(--border)] ${
                      isCurrent ? 'bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]' : ''
                    }`}
                  >
                    <th scope="row" className="p-2 text-start font-black text-[var(--text)]">
                      {run.label}
                      <span className="block text-[11px] font-semibold text-muted">
                        {ALGORITHMS.find((algorithm) => algorithm.id === run.selection.id)?.variants.find(
                          (variant) => variant.value === run.selection.variant,
                        )?.label ?? ''}
                      </span>
                      {run.error && (
                        <span className="block text-[11px] font-bold text-rose-700 dark:text-rose-300">
                          خطا: {run.error}
                        </span>
                      )}
                    </th>
                    <td className="p-2 text-center font-black tabular-nums">
                      {faNumber.format(summary.sheetCount)}
                      {isBestSheets && <span className="ms-1" title="کمترین تعداد ورق">🏆</span>}
                    </td>
                    <td className="p-2 text-center tabular-nums text-rose-700 dark:text-rose-300">
                      {faDecimal.format(summary.wastePercentage)}
                      {isBestWaste && <span className="ms-1" title="کمترین پرت">⭐</span>}
                    </td>
                    <td className="p-2 text-center tabular-nums text-emerald-700 dark:text-emerald-300">
                      {faDecimal.format(summary.utilizationPercentage)}
                    </td>
                    <td className="p-2 text-center tabular-nums">
                      {summary.unplacedCount > 0 ? (
                        <span className="font-black text-rose-700 dark:text-rose-300">
                          {faNumber.format(summary.unplacedCount)}
                        </span>
                      ) : (
                        '۰'
                      )}
                    </td>
                    <td className="p-2 text-center tabular-nums">
                      {faDecimal.format((run.result.metrics?.cutLength ?? 0) / 1000)}
                    </td>
                    <td className="p-2 text-center tabular-nums">
                      {faNumber.format(run.result.metrics?.cutCount ?? 0)}
                    </td>
                    <td className="p-2 text-center tabular-nums text-muted">
                      {faNumber.format(run.result.metrics?.elapsedMs ?? 0)}
                    </td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        className={`btn ${isCurrent ? 'btn-secondary' : 'btn-primary'} px-2 py-1 text-xs`}
                        disabled={isCurrent || Boolean(run.error)}
                        onClick={() => onUse(run.selection)}
                      >
                        {isCurrent ? 'فعال' : 'انتخاب'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows.length === 0 && !busy && (
        <p className="mt-3 text-sm font-semibold text-muted">
          هنوز مقایسه‌ای اجرا نشده است. دکمهٔ «مقایسهٔ الگوریتم‌ها» را بزنید.
        </p>
      )}
    </section>
  );
}
