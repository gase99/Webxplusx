import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { calculateLayout, type LayoutResult } from '../algorithm';
import { isValidPart, type CutPart } from '../types/part';
import {
  computeLayoutSignature,
  type LayoutSettings,
  type LayoutState,
} from '../types/project';
import { downloadDxf } from '../exportDxf';
import CuttingMap from './CuttingMap';
import LabelSheet from './LabelSheet';
import ControlSheet from './ControlSheet';

const faNumber = new Intl.NumberFormat('fa-IR');
const faDecimal = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });

/** تبدیل ارقام فارسی/عربی به لاتین (هم‌رفتار با جدول ورود اطلاعات) */
function parseMm(raw: string): number {
  const normalized = raw
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[^0-9.]/g, '');
  const value = parseFloat(normalized);
  return Number.isFinite(value) ? value : 0;
}

/** اندازه‌های رایج ورق خام در بازار (طول × عرض — میلی‌متر) */
const STOCK_PRESETS: { label: string; length: number; width: number }[] = [
  { label: '۳۶۶۰ × ۱۸۳۰', length: 3660, width: 1830 },
  { label: '۲۴۴۰ × ۱۲۲۰', length: 2440, width: 1220 },
  { label: '۲۸۰۰ × ۲۰۷۰', length: 2800, width: 2070 },
];

interface LayoutPanelProps {
  parts: CutPart[];
  /** تنظیمات ورق/تیغه — کنترل‌شده از App تا بخشی از پروژه باشد (فاز ۵) */
  settings: LayoutSettings;
  onSettingsChange: (settings: LayoutSettings) => void;
  /** نتیجهٔ چیدمان + اسنپ‌شات قطعاتش — کنترل‌شده از App تا در پروژه ذخیره شود */
  layoutState: LayoutState | null;
  onLayoutStateChange: (state: LayoutState | null) => void;
}

/**
 * پنل فاز ۲ و ۳ — تنظیمات صفحهٔ خام و تیغه + اجرای موتور چیدمان گیلوتینی
 * و نمایش بلافاصلهٔ نقشهٔ برش (CuttingMap) زیر خلاصهٔ نتیجه.
 */
export default function LayoutPanel({
  parts,
  settings,
  onSettingsChange,
  layoutState,
  onLayoutStateChange,
}: LayoutPanelProps) {
  const { stockLength, stockWidth, kerf, allowRotation } = settings;
  const setStockLength = (v: number) => onSettingsChange({ ...settings, stockLength: v });
  const setStockWidth = (v: number) => onSettingsChange({ ...settings, stockWidth: v });
  const setKerf = (v: number) => onSettingsChange({ ...settings, kerf: v });
  const setAllowRotation = (v: boolean) => onSettingsChange({ ...settings, allowRotation: v });

  const result = layoutState?.result ?? null;
  const resultParts = layoutState?.partsSnapshot ?? [];
  const resultRef = useRef<HTMLDivElement | null>(null);
  const isFirstResultRef = useRef(true);
  /** حالت سند چاپی فعال: نقشه یا لیبل (فاز ۴) */
  const [printMode, setPrintMode] = useState<'map' | 'labels' | null>(null);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validParts = useMemo(() => parts.filter(isValidPart), [parts]);

  /** امضای ورودی‌های فعلی؛ برای تشخیص «نتیجهٔ قدیمی» بعد از ویرایش جدول/تنظیمات */
  const currentSignature = useMemo(
    () => computeLayoutSignature(parts, settings),
    [parts, settings],
  );
  const resultSignature = layoutState?.signature ?? null;

  const isStale = result !== null && resultSignature !== currentSignature;
  const canCalculate = validParts.length > 0 && stockLength > 0 && stockWidth > 0;

  const handleCalculate = () => {
    if (validParts.length === 0) {
      setError('هنوز هیچ ردیف کاملی (طول، عرض و تعداد) در جدول وارد نشده است.');
      return;
    }
    if (!(stockLength > 0) || !(stockWidth > 0)) {
      setError('ابعاد صفحهٔ خام باید بزرگ‌تر از صفر باشد.');
      return;
    }
    setError(null);

    const layout = calculateLayout(
      parts,
      { length: stockLength, width: stockWidth },
      { kerf, allowRotation },
    );

    // خروجی فاز ۲ برای بررسی و دیباگ: چاپ در کنسول مرورگر + نگه‌داری برای نمایش JSON
    console.log('[A-Cut 2Dpro] Layout Result (Guillotine):', layout);
    console.table(layout.placements);
    if (layout.unplaced.length > 0) {
      console.warn('[A-Cut 2Dpro] Unplaced parts:', layout.unplaced);
    }

    onLayoutStateChange({
      result: layout,
      // فلگ‌های نقشه از همین اسنپ‌شات خوانده می‌شوند و همراه پروژه ذخیره می‌شود
      partsSnapshot: parts.map((part) => ({ ...part })),
      signature: currentSignature,
    });
    setCopied(false);
  };

  useEffect(() => {
    // در بارگذاری اولیه (مثلاً بازیابی پیش‌نویس) صفحه اسکرول نشود
    if (isFirstResultRef.current) {
      isFirstResultRef.current = false;
      return;
    }
    if (result) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [result]);

  // وقتی حالت چاپ فعال شد: سند چاپی در Portal رندر شده؛ بعد از دو فریم چاپ را باز کن
  useEffect(() => {
    if (!printMode) return;
    document.documentElement.dataset.printMode = printMode;
    const clear = () => setPrintMode(null);
    window.addEventListener('afterprint', clear);
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('afterprint', clear);
      delete document.documentElement.dataset.printMode;
    };
  }, [printMode]);

  const handleDownloadDxf = () => {
    if (result) downloadDxf(result, resultParts);
  };

  const handleCopyJson = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const numberInputClass =
    'w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-center text-sm font-bold tabular-nums outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200';

  return (
    <>
    <section className="rounded-2xl bg-white px-4 py-3.5 shadow-sm ring-1 ring-slate-300/70">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-extrabold text-slate-800">
          ⚙️ فاز ۲ — موتور بهینه‌سازی برش
          <span className="ms-2 text-xs font-medium text-slate-400" dir="ltr">
            Guillotine Nesting
          </span>
        </h2>
        <span className="ms-auto hidden text-xs text-slate-400 sm:block">
          بعد از محاسبه، نقشهٔ برش (SVG) با علائم نوار/فارسی/شیار بلافاصله زیر نتیجه رسم می‌شود.
        </span>
      </div>

      {/* فرم صفحهٔ خام و تیغه */}
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block w-32">
          <span className="mb-1 block text-xs font-semibold text-slate-500">
            طول صفحهٔ خام <span className="font-normal text-slate-400">(mm)</span>
          </span>
          <input
            type="text"
            inputMode="decimal"
            dir="ltr"
            value={stockLength ? String(stockLength) : ''}
            placeholder="3660"
            onChange={(e) => setStockLength(parseMm(e.target.value))}
            onFocus={(e) => e.target.select()}
            className={numberInputClass}
          />
        </label>

        <span className="pb-2.5 font-bold text-slate-300">×</span>

        <label className="block w-32">
          <span className="mb-1 block text-xs font-semibold text-slate-500">
            عرض صفحهٔ خام <span className="font-normal text-slate-400">(mm)</span>
          </span>
          <input
            type="text"
            inputMode="decimal"
            dir="ltr"
            value={stockWidth ? String(stockWidth) : ''}
            placeholder="1830"
            onChange={(e) => setStockWidth(parseMm(e.target.value))}
            onFocus={(e) => e.target.select()}
            className={numberInputClass}
          />
        </label>

        <label className="block w-28">
          <span className="mb-1 block text-xs font-semibold text-slate-500">
            ضخامت تیغه <span className="font-normal text-slate-400" dir="ltr">Kerf (mm)</span>
          </span>
          <input
            type="text"
            inputMode="decimal"
            dir="ltr"
            value={String(kerf)}
            placeholder="4"
            onChange={(e) => setKerf(parseMm(e.target.value))}
            onFocus={(e) => e.target.select()}
            className={numberInputClass}
          />
        </label>

        <label
          className="flex cursor-pointer items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200"
          title="در فازهای بعدی با قفل جهت رگهٔ چوب (گرین)، این گزینه به‌ازای هر قطعه جدا می‌شود"
        >
          <input
            type="checkbox"
            checked={allowRotation}
            onChange={(e) => setAllowRotation(e.target.checked)}
            className="h-[18px] w-[18px] accent-sky-700"
          />
          چرخش ۹۰° قطعات مجاز است
        </label>

        <div className="flex items-center gap-1.5 pb-0.5">
          <span className="text-[11px] text-slate-400">اندازه‌های رایج:</span>
          {STOCK_PRESETS.map((preset) => {
            const active = stockLength === preset.length && stockWidth === preset.width;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() =>
                  // یک به‌روزرسانی واحد؛ دو setter جداگانه روی شیء کنترل‌شده هم را بازنویسی می‌کنند
                  onSettingsChange({ ...settings, stockLength: preset.length, stockWidth: preset.width })
                }
                className={`rounded-md px-2 py-1.5 text-xs font-bold tabular-nums ring-1 transition ${
                  active
                    ? 'bg-sky-700 text-white ring-sky-700'
                    : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-100'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleCalculate}
          disabled={!canCalculate}
          className="ms-auto inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M7 4.5v15c0 .8.9 1.3 1.6.9l12-7.5c.6-.4.6-1.4 0-1.8l-12-7.5c-.7-.4-1.6.1-1.6.9Z" />
          </svg>
          محاسبهٔ چیدمان
          <span className="text-[11px] font-semibold opacity-80" dir="ltr">
            Calculate Layout
          </span>
        </button>
      </div>

      {validParts.length === 0 && (
        <p className="mt-2 text-xs text-slate-400">
          ابتدا در جدول زیر دست‌کم یک قطعه با طول، عرض و تعداد کامل وارد کنید.
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800 ring-1 ring-rose-200">
          ⚠ {error}
        </p>
      )}

      {/* نتیجهٔ محاسبه */}
      {result && (
        <div ref={resultRef} className="mt-4 scroll-mt-4 border-t border-dashed border-slate-200 pt-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-extrabold text-slate-800">نتیجهٔ چیدمان</h3>
            {isStale ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-amber-300">
                ⚠ داده‌ها تغییر کرده‌اند — این نتیجه قدیمی است، دوباره محاسبه کنید
              </span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-300">
                ✓ به‌روز
              </span>
            )}
            <span className="ms-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowJson((v) => !v)}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-200"
              >
                {showJson ? 'پنهان‌کردن JSON' : 'مشاهدهٔ JSON خروجی'}
              </button>
              <button
                type="button"
                onClick={handleCopyJson}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-200"
              >
                {copied ? '✓ کپی شد' : 'کپی JSON'}
              </button>
            </span>
          </div>

          {/* شاخص‌های اصلی: صفحات مصرفی + درصد پرت */}
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <ResultCard
              title="صفحات خام مصرفی"
              value={`${faNumber.format(result.summary.sheetCount)} صفحه`}
              hint={`هر صفحه ${faNumber.format(result.stock.length)} × ${faNumber.format(result.stock.width)}`}
            />
            <ResultCard
              title="درصد پرت (Waste)"
              value={`${faDecimal.format(result.summary.wastePercentage)}٪`}
              hint="شامل خوراک تیغه (Kerf)"
              accent="text-rose-700"
            />
            <ResultCard
              title="بهره‌وری ورق"
              value={`${faDecimal.format(result.summary.utilizationPercentage)}٪`}
              hint={`${faDecimal.format(result.summary.usedArea / 1_000_000)} از ${faDecimal.format(result.summary.totalSheetArea / 1_000_000)} مترمربع`}
              accent="text-emerald-700"
            />
            <ResultCard
              title="قطعات چیده‌شده"
              value={`${faNumber.format(result.summary.placedCount)} از ${faNumber.format(result.summary.totalParts)}`}
              hint={
                result.summary.unplacedCount > 0
                  ? `${faNumber.format(result.summary.unplacedCount)} قطعه جا نشد!`
                  : 'همهٔ قطعات چیده شدند'
              }
              accent={result.summary.unplacedCount > 0 ? 'text-rose-700' : 'text-slate-800'}
            />
          </div>

          {/* ریز هر صفحه (متنی — نقشهٔ گرافیکی در فاز ۳) */}
          {result.sheets.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {result.sheets.map((sheet) => (
                <span
                  key={sheet.sheetIndex}
                  className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"
                >
                  صفحهٔ {faNumber.format(sheet.sheetIndex + 1)}:{' '}
                  <span className="text-slate-800">
                    بهره‌وری {faDecimal.format(sheet.utilizationPercentage)}٪
                  </span>{' '}
                  · پرت {faDecimal.format(sheet.wastePercentage)}٪ ·{' '}
                  {faNumber.format(sheet.placements.length)} قطعه
                </span>
              ))}
            </div>
          )}

          {/* فاز ۴: نوار ابزار خروجی‌ها (پرینت نقشه / DXF / لیبل) */}
          {result.sheets.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-slate-800 px-3 py-2.5">
              <span className="text-xs font-extrabold text-slate-200">خروجی‌ها:</span>
              <button
                type="button"
                onClick={() => setPrintMode('map')}
                disabled={isStale}
                title={isStale ? 'ابتدا دوباره محاسبه کنید' : 'چاپ نقشه روی A4 افقی (قابل ذخیره به‌صورت PDF)'}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-800 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                🖨️ پرینت نقشه (PDF)
              </button>
              <button
                type="button"
                onClick={handleDownloadDxf}
                disabled={isStale}
                title={isStale ? 'ابتدا دوباره محاسبه کنید' : 'فایل DXF (R12) با لایه‌های CUT / GROOVE / FARSI_45 برای CNC'}
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ⬇️ دانلود DXF برای CNC
              </button>
              <button
                type="button"
                onClick={() => setPrintMode('labels')}
                disabled={isStale}
                title={isStale ? 'ابتدا دوباره محاسبه کنید' : 'چاپ برچسب قطعات — شبکهٔ ۳×۵ روی A4'}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-800 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                🏷️ چاپ لیبل‌ها
              </button>
              <button
                type="button"
                onClick={() => setLabelsOpen((v) => !v)}
                className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-bold text-slate-100 ring-1 ring-slate-600 transition hover:bg-slate-600"
              >
                {labelsOpen ? 'بستن پیش‌نمایش لیبل' : '👁️ پیش‌نمایش لیبل‌ها'}
              </button>
              <span className="ms-auto hidden text-[11px] text-slate-400 lg:block">
                در DXF هر ورق کنار بعدی قرار می‌گیرد؛ کد هر قطعه (مثل S1-03) با لیبل چاپی‌اش یکی است.
              </span>
            </div>
          )}

          {/* فاز ۳: نقشهٔ برش SVG روی همین خروجی placements/sheets — هاشور ضایعات = هاشور مورب پرت */}
          {result.sheets.length > 0 && (
            <CuttingMap sheets={result.sheets} stock={result.stock} parts={resultParts} />
          )}

          {/* برگه کنترل کارگاهی (قابل چاپ) — ورودی ۰/۱/۲ و هاشور ضایعات */}
          {result.sheets.length > 0 && (
            <ControlSheet result={result} parts={resultParts} />
          )}

          {/* پیش‌نمایش روی‌صفحهٔ لیبل‌ها (همان چیزی که چاپ می‌شود) */}
          {labelsOpen && result.placements.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-800">
                  🏷️ لیبل قطعات
                  <span className="ms-2 text-xs font-medium text-slate-400">
                    شبکهٔ ۳ × ۵ در هر صفحهٔ A4 — {faNumber.format(result.placements.length)} لیبل
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={() => setPrintMode('labels')}
                  disabled={isStale}
                  className="ms-auto rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  🖨️ چاپ لیبل‌ها
                </button>
              </div>
              <div className="table-scroll overflow-x-auto rounded-2xl bg-slate-200/70 p-3">
                <LabelSheet placements={result.placements} parts={resultParts} />
              </div>
            </div>
          )}

          {/* قطعات جانشده */}
          {result.unplaced.length > 0 && (
            <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-900 ring-1 ring-rose-200">
              <p className="font-bold">
                ⚠ این قطعات حتی در صفحهٔ خالی هم جا نمی‌شوند (در هیچ‌کدام از دو جهت):
              </p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-[13px]">
                {result.unplaced.map((p) => (
                  <li key={`${p.id}-${p.instanceIndex}`}>
                    «{p.name?.trim() || 'بدون نام'}» نمونهٔ {faNumber.format(p.instanceIndex)} —{' '}
                    <span dir="ltr" className="tabular-nums">
                      {p.length} × {p.width} mm
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-2.5 text-[11px] text-slate-400">
            نتیجهٔ کامل (مختصات x/y، شمارهٔ صفحه، چرخش و ابعاد نهایی هر قطعه) در کنسول مرورگر
            (کلید <span dir="ltr">F12 ← Console</span>) هم چاپ شده است.
          </p>

          {showJson && (
            <pre
              dir="ltr"
              className="mt-2 max-h-[420px] overflow-auto rounded-xl bg-slate-900 p-4 text-left font-mono text-[11px] leading-5 text-emerald-200"
            >
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </section>

    {/* سند چاپی (فاز ۴): فقط در حالت چاپ از طریق Portal روی body دیده می‌شود */}
    {printMode &&
      result &&
      createPortal(
        <div className="print-portal">
          {printMode === 'map' ? (
            <PrintMapDocument result={result} parts={resultParts} />
          ) : (
            <div className="print-doc-labels">
              <LabelSheet placements={result.placements} parts={resultParts} />
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

/**
 * سند چاپی نقشهٔ برش: سربرگ خلاصه + خود نقشه (بدون کنترل‌های تعاملی).
 * در CSS چاپ، این سند روی A4 افقی (Landscape) تنظیم شده است.
 */
function PrintMapDocument({ result, parts }: { result: LayoutResult; parts: CutPart[] }) {
  const today = new Date().toLocaleDateString('fa-IR');
  const { summary } = result;
  return (
    <div className="print-doc-map text-slate-900">
      <header className="mb-3 flex flex-wrap items-end gap-x-4 gap-y-1 border-b-2 border-slate-800 pb-2">
        <div>
          <h1 className="text-lg font-black">
            نقشهٔ برش <span dir="ltr">A-Cut 2Dpro</span>
          </h1>
          <p className="text-xs text-slate-500">تاریخ: {today}</p>
        </div>
        <ul className="ms-auto flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
          <li>
            ورق خام:{' '}
            <span dir="ltr" className="tabular-nums">
              {result.stock.length} × {result.stock.width} mm
            </span>
          </li>
          <li>
            تیغه (Kerf): <span dir="ltr" className="tabular-nums">{result.kerf} mm</span>
          </li>
          <li>صفحات مصرفی: {faNumber.format(summary.sheetCount)}</li>
          <li>بهره‌وری: {faDecimal.format(summary.utilizationPercentage)}٪</li>
          <li>پرت: {faDecimal.format(summary.wastePercentage)}٪</li>
          <li>
            قطعات: {faNumber.format(summary.placedCount)} از {faNumber.format(summary.totalParts)}
          </li>
        </ul>
      </header>
      <CuttingMap sheets={result.sheets} stock={result.stock} parts={parts} forPrint />
    </div>
  );
}

function ResultCard({
  title,
  value,
  hint,
  accent = 'text-slate-800',
}: {
  title: string;
  value: string;
  hint: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-3.5 py-3 ring-1 ring-slate-200">
      <p className="text-[11px] font-semibold text-slate-500">{title}</p>
      <p className={`mt-0.5 text-lg font-black tabular-nums ${accent}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>
    </div>
  );
}
