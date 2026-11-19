import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LayoutResult, PackingProgress } from '../algorithm';
import { calculateCutDimensions, type CutPart } from '../types/part';
import {
  BAND_COLOR_PRESETS,
  SHEET_COLOR_PRESETS,
  type LayoutSettings,
} from '../types/project';
import { downloadDxf } from '../exportDxf';
import { logger } from '../lib/logger';
import { prefersPdfExport } from '../platform';
import CuttingMap from './CuttingMap';
import LabelSheet from './LabelSheet';
import ControlSheet, { PrintPartsList } from './ControlSheet';

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

export type LayoutPage = 'parts' | 'map' | 'results';

/**
 * نمای موتور چیدمان که App می‌سازد و به همهٔ صفحه‌ها می‌دهد؛ به این ترتیب
 * «محاسبه» فقط یک‌بار تعریف شده و نتیجه بین صفحه‌ها مشترک است.
 */
export interface LayoutEngineView {
  result: LayoutResult | null;
  resultParts: CutPart[];
  isStale: boolean;
  busy: boolean;
  progress: PackingProgress | null;
  error: string | null;
  warnings: string[];
  canCalculate: boolean;
  /** اجرای محاسبه (نتیجه در App ذخیره می‌شود) */
  calculate: () => void;
  cancel: () => void;
}

interface LayoutPanelProps {
  page: LayoutPage;
  parts: CutPart[];
  /** تنظیمات ورق/تیغه — کنترل‌شده از App تا بخشی از پروژه باشد */
  settings: LayoutSettings;
  onSettingsChange: (settings: LayoutSettings) => void;
  /** موتور مشترک محاسبه (نتیجه، وضعیت قدیمی‌بودن، اجرا و لغو) */
  engine: LayoutEngineView;
}

/**
 * پنل صفحه‌های «داشبورد/تنظیمات»، «نقشه و لیبل‌ها» و «خروجی‌ها».
 * منطق محاسبه یک‌جا نگه داشته شده است تا هر سه صفحه همیشه یک نتیجهٔ
 * مشترک را نشان دهند و قانون کسر ضخامت نوار/استریپ فقط در یک نقطه باشد.
 */
export default function LayoutPanel({
  page,
  parts,
  settings,
  onSettingsChange,
  engine,
}: LayoutPanelProps) {
  const { stockLength, stockWidth, kerf, allowRotation, bandThickness } = settings;
  const setStockLength = (v: number) => onSettingsChange({ ...settings, stockLength: v });
  const setStockWidth = (v: number) => onSettingsChange({ ...settings, stockWidth: v });
  const setKerf = (v: number) => onSettingsChange({ ...settings, kerf: v });
  const setBandThickness = (v: number) => onSettingsChange({ ...settings, bandThickness: v });
  const setAllowRotation = (v: boolean) => onSettingsChange({ ...settings, allowRotation: v });
  const setSheetColor = (v: string) => onSettingsChange({ ...settings, sheetColor: v });
  const setBandColor = (v: string) => onSettingsChange({ ...settings, bandColor: v });

  const {
    result,
    resultParts,
    isStale,
    busy,
    progress,
    error,
    warnings,
    canCalculate,
    calculate,
    cancel,
  } = engine;
  const resultRef = useRef<HTMLDivElement | null>(null);
  const isFirstResultRef = useRef(true);
  /** حالت سند چاپی فعال در دسکتاپ: نقشه (همراه فهرست قطعات) یا لیبل */
  const [printMode, setPrintMode] = useState<'map' | 'labels' | null>(null);
  /** درخواست ساخت PDF — جایگزین چاپ روی موبایل/APK/PWA که window.print ندارد */
  const [pdfRequest, setPdfRequest] = useState<'map' | 'labels' | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const printPortalRef = useRef<HTMLDivElement | null>(null);
  /** موبایل/اپ بومی/PWA نصب‌شده ← خروجی PDF؛ مرورگر دسکتاپ ← چاپ مستقیم */
  const prefersPdf = useMemo(() => prefersPdfExport(), []);
  const pdfBusy = pdfRequest !== null;
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);

  const validParts = useMemo(
    () => parts.filter((part) => part.length > 0 && part.width > 0 && part.qty > 0),
    [parts],
  );

  const handleCalculate = calculate;

  useEffect(() => {
    // در بارگذاری اولیه (مثلاً بازیابی پیش‌نویس) صفحه اسکرول نشود
    if (isFirstResultRef.current) {
      isFirstResultRef.current = false;
      return;
    }
    if (result && page === 'map') {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [result, page]);

  // وقتی حالت چاپ فعال شد (فقط دسکتاپ): سند در Portal رندر شده؛ بعد از دو فریم چاپ را باز کن
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

  // موبایل/APK/PWA: window.print کار نمی‌کند؛ همان سند Portal با حالت ضبط
  // (data-pdf-capture) بیرون از دید و با عرض A4 چیده و به PDF تبدیل می‌شود.
  useEffect(() => {
    if (!pdfRequest || !result) return;
    let cancelled = false;
    const kind = pdfRequest;
    document.documentElement.dataset.pdfCapture = kind;
    const title = kind === 'map' ? 'نقشهٔ برش و فهرست قطعات' : 'لیبل قطعات';
    const filename =
      kind === 'map'
        ? `ACut_map_${result.stock.length}x${result.stock.width}_${result.summary.sheetCount}sheets.pdf`
        : `ACut_labels_${result.stock.length}x${result.stock.width}.pdf`;
    void (async () => {
      try {
        // صبر برای چیدمان نهایی سند در Portal و آماده‌شدن فونت‌ها قبل از ضبط
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        await document.fonts?.ready;
        await new Promise<void>((resolve) => window.setTimeout(resolve, 60));
        if (cancelled) return;
        const portalEl = printPortalRef.current;
        if (!portalEl) throw new Error('سند خروجی پیدا نشد');
        // بارگذاری پویا: بستهٔ PDF فقط هنگام نیاز گرفته می‌شود
        const { generateAndDeliverPdf } = await import('../exportPdf');
        if (cancelled) return;
        await generateAndDeliverPdf(portalEl, kind, filename, title);
      } catch (err) {
        logger.error('ساخت PDF ناموفق بود', err);
        if (!cancelled) {
          setPdfError(
            'ساخت فایل PDF ناموفق بود؛ لطفاً چند ثانیه صبر و دوباره تلاش کنید. اگر مشکل ادامه داشت، از نسخهٔ دسکتاپ چاپ بگیرید.',
          );
        }
      } finally {
        if (!cancelled) {
          delete document.documentElement.dataset.pdfCapture;
          setPdfRequest(null);
        }
      }
    })();
    return () => {
      cancelled = true;
      delete document.documentElement.dataset.pdfCapture;
    };
  }, [pdfRequest, result]);

  /** دکمه‌های خروجی: روی موبایل به PDF و روی دسکتاپ به چاپ مستقیم می‌روند */
  const requestDocument = (kind: 'map' | 'labels') => {
    setPdfError(null);
    if (prefersPdf) setPdfRequest(kind);
    else setPrintMode(kind);
  };

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

  const effectiveExample = calculateCutDimensions({ length: 400, width: 400, bandLength: 1, bandWidth: 0 }, bandThickness);

  return (
    <>
      {page === 'parts' && (
        <section className="panel panel-accent p-4 sm:p-6" aria-labelledby="settings-title">
          <div className="flex flex-wrap items-start gap-3">
            <div>
              <span className="badge mb-2">قطعات · تنظیمات ورق</span>
              <h2 id="settings-title" className="panel-title">
                تنظیمات ورق، تیغه و نوار/استریپ
              </h2>
              <p className="mt-1 max-w-3xl text-[0.98rem] font-semibold text-muted">
                ابعاد و رنگ ورق، اندازهٔ تیغه و ضخامت نوار/استریپ را اینجا تنظیم کنید. همین مقادیر
                مبنای محاسبهٔ قطعات و خروجی‌های صفحه‌های بعد هستند.
              </p>
            </div>
            <span className="badge ms-auto">مرحلهٔ ۱ از ۳</span>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="block">
              <span className="field-label">
                طول ورق خام
                <span className="text-subtle text-xs font-bold" dir="ltr">mm</span>
              </span>
              <input
                type="text"
                inputMode="decimal"
                dir="ltr"
                value={stockLength ? String(stockLength) : ''}
                placeholder="3660"
                onChange={(e) => setStockLength(parseMm(e.target.value))}
                onFocus={(e) => e.target.select()}
                className="field-input"
              />
            </label>

            <label className="block">
              <span className="field-label">
                عرض ورق خام
                <span className="text-subtle text-xs font-bold" dir="ltr">mm</span>
              </span>
              <input
                type="text"
                inputMode="decimal"
                dir="ltr"
                value={stockWidth ? String(stockWidth) : ''}
                placeholder="1830"
                onChange={(e) => setStockWidth(parseMm(e.target.value))}
                onFocus={(e) => e.target.select()}
                className="field-input"
              />
            </label>

            <label className="block">
              <span className="field-label">
                اندازهٔ تیغه (Blade)
                <span className="text-subtle text-xs font-bold" dir="ltr">mm</span>
              </span>
              <input
                type="text"
                inputMode="decimal"
                dir="ltr"
                value={String(kerf)}
                placeholder="4"
                onChange={(e) => setKerf(parseMm(e.target.value))}
                onFocus={(e) => e.target.select()}
                className="field-input"
              />
            </label>

            <label className="block">
              <span className="field-label">
                ضخامت نوار/استریپ
                <span className="text-subtle text-xs font-bold" dir="ltr">mm</span>
              </span>
              <input
                type="text"
                inputMode="decimal"
                dir="ltr"
                value={String(bandThickness)}
                placeholder="0"
                onChange={(e) => setBandThickness(parseMm(e.target.value))}
                onFocus={(e) => e.target.select()}
                className="field-input"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ColorField
              label="رنگ ورق"
              hint="پس‌زمینهٔ ورق در نقشه و پیش‌نمایش"
              value={settings.sheetColor}
              presets={SHEET_COLOR_PRESETS}
              onChange={setSheetColor}
            />
            <ColorField
              label="رنگ نوار/استریپ"
              hint="رنگ لبه‌های نوارخورده در نقشه و لیبل"
              value={settings.bandColor}
              presets={BAND_COLOR_PRESETS}
              onChange={setBandColor}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-extrabold text-muted">اندازه‌های رایج ورق:</span>
            {STOCK_PRESETS.map((preset) => {
              const active = stockLength === preset.length && stockWidth === preset.width;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    onSettingsChange({
                      ...settings,
                      stockLength: preset.length,
                      stockWidth: preset.width,
                    })
                  }
                  className={`rounded-xl border-2 px-3 py-1.5 text-sm font-black tabular-nums transition ${
                    active
                      ? 'border-cyan-600 bg-cyan-600 text-white dark:border-cyan-300 dark:bg-cyan-400 dark:text-slate-950'
                      : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:border-cyan-500'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border-2 border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
            <input
              type="checkbox"
              checked={allowRotation}
              onChange={(e) => setAllowRotation(e.target.checked)}
              className="h-6 w-6 accent-cyan-600"
            />
            <span>
              <span className="block text-base font-black text-[var(--text)]">
                چرخش ۹۰ درجهٔ قطعات مجاز است
              </span>
              <span className="block text-sm font-semibold text-muted">
                اگر رگه/گرین چوب مهم است، این گزینه را خاموش کنید تا همهٔ قطعات هم‌جهت بمانند.
              </span>
            </span>
          </label>

          <div className="info-box mt-4">
            <p className="text-base font-black">قانون کسر خودکار ضخامت نوار/استریپ</p>
            <p className="mt-1 text-sm font-semibold leading-7">
              ضخامت نوار از بعد عمود بر لبهٔ نوارخورده کم می‌شود. مثال با تنظیمات فعلی:
              قطعهٔ ۴۰۰ میلی‌متری با <b>یک لبهٔ نوار</b> و ضخامت{' '}
              <b dir="ltr">{faNumber.format(bandThickness)} mm</b> برای برش{' '}
              <b dir="ltr">{faNumber.format(Math.max(0, effectiveExample.width))} mm</b> در نظر گرفته
              می‌شود (۴۰۰ − {faNumber.format(bandThickness)}). همین قاعده در نقشه، لیبل، DXF و
              محاسبهٔ پرت اعمال می‌شود.
            </p>
          </div>

          {error && (
            <p className="mt-4 rounded-xl border-2 border-rose-400/60 bg-rose-500/10 px-4 py-3 text-base font-bold text-rose-700 dark:text-rose-200">
              ⚠ {error}
            </p>
          )}

          {validParts.length === 0 && (
            <p className="mt-3 text-sm font-semibold text-muted">
              ابتدا دست‌کم یک قطعه با طول، عرض و تعداد کامل در بخش «ورود قطعات» پایین همین صفحه
              ثبت کنید.
            </p>
          )}

          {warnings.length > 0 && (
            <ul className="mt-4 space-y-1 rounded-xl border-2 border-amber-400/70 bg-amber-500/12 px-4 py-3 text-sm font-bold text-amber-800 dark:text-amber-200">
              {warnings.map((warning) => (
                <li key={warning}>⚠ {warning}</li>
              ))}
            </ul>
          )}

          {busy && (
            <div className="mt-4 rounded-xl border-2 border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-4 py-3">
              <p className="text-sm font-black text-[var(--text)]">
                {progress?.message ?? 'در حال محاسبهٔ چیدمان…'}
                {progress ? ` — ${faNumber.format(Math.round(progress.ratio * 100))}٪` : ''}
              </p>
              <div
                className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-3)]"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round((progress?.ratio ?? 0) * 100)}
                aria-label="پیشرفت محاسبه"
              >
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-200"
                  style={{ width: `${Math.round((progress?.ratio ?? 0) * 100)}%` }}
                />
              </div>
              <button type="button" onClick={cancel} className="btn btn-secondary mt-2 px-3 py-1 text-xs">
                لغو محاسبه
              </button>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCalculate}
              disabled={!canCalculate || busy}
              className="btn btn-success px-6 py-3 text-lg"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                <path d="M7 4.5v15c0 .8.9 1.3 1.6.9l12-7.5c.6-.4.6-1.4 0-1.8l-12-7.5c-.7-.4-1.6.1-1.6.9Z" />
              </svg>
              محاسبه و به‌روزرسانی چیدمان
            </button>
            <span className="text-sm font-semibold text-muted">
              نتیجه در صفحهٔ «نقشه و لیبل‌ها» و «خروجی‌ها» نمایش داده می‌شود.
            </span>
          </div>
        </section>
      )}

      {page === 'map' && (
        <section className="space-y-5" aria-labelledby="drawing-title">
          <div className="panel p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <span className="badge mb-2">نقشه · چیدمان</span>
                <h2 id="drawing-title" className="panel-title">
                  نقشهٔ برش، لیبل‌ها و راهنمای علائم
                </h2>
                <p className="mt-1 text-sm font-semibold text-muted">
                  چیدمان گیلوتینی روی ورق‌های خام، همراه با لیبل‌های کارگاهی قطعات.
                </p>
              </div>
              <div className="ms-auto flex flex-wrap items-center gap-2">
                {result && (
                  <span
                    className={`badge ${
                      isStale
                        ? 'border-amber-400/70 bg-amber-500/15 text-amber-800 dark:text-amber-200'
                        : 'border-emerald-400/70 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
                    }`}
                  >
                    {isStale ? '⚠ نتیجه قدیمی است' : '✓ نتیجه به‌روز'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleCalculate}
                  disabled={!canCalculate || busy}
                  className="btn btn-success"
                >
                  {busy ? '⏳ در حال محاسبه…' : 'محاسبه / به‌روزرسانی نقشه'}
                </button>
              </div>
            </div>

            {error && (
              <p className="mt-3 rounded-xl border-2 border-rose-400/60 bg-rose-500/10 px-4 py-3 text-base font-bold text-rose-700 dark:text-rose-200">
                ⚠ {error}
              </p>
            )}

            {!result && (
              <div className="empty-state mt-4">
                <p className="text-xl font-black text-[var(--text)]">هنوز چیدمانی محاسبه نشده است</p>
                <p className="mt-2 text-base font-semibold">
                  ابتدا در صفحهٔ «داشبورد و تنظیمات» ابعاد ورق و قطعات را وارد کنید، سپس دکمهٔ
                  «محاسبه» را بزنید.
                </p>
              </div>
            )}
          </div>

          {result && (
            <div ref={resultRef} className="scroll-mt-4 space-y-5">
              {isStale && (
                <p className="rounded-xl border-2 border-amber-400/70 bg-amber-500/12 px-4 py-3 text-base font-bold text-amber-800 dark:text-amber-200">
                  ⚠ داده‌ها بعد از محاسبه تغییر کرده‌اند؛ نقشه و لیبل‌های زیر مربوط به نتیجهٔ قبلی
                  هستند. برای خروجی درست، دوباره «محاسبه / به‌روزرسانی نقشه» را بزنید.
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <ResultCard
                  title="ورق‌های مصرفی"
                  value={`${faNumber.format(result.summary.sheetCount)} صفحه`}
                  hint={`هر ورق ${faNumber.format(result.stock.length)} × ${faNumber.format(result.stock.width)}`}
                />
                <ResultCard
                  title="درصد پرت"
                  value={`${faDecimal.format(result.summary.wastePercentage)}٪`}
                  hint="شامل خوراک تیغه (Kerf)"
                  accent="text-rose-700 dark:text-rose-300"
                />
                <ResultCard
                  title="بهره‌وری ورق"
                  value={`${faDecimal.format(result.summary.utilizationPercentage)}٪`}
                  hint={`${faDecimal.format(result.summary.usedArea / 1_000_000)} از ${faDecimal.format(result.summary.totalSheetArea / 1_000_000)} مترمربع`}
                  accent="text-emerald-700 dark:text-emerald-300"
                />
                <ResultCard
                  title="قطعات چیده‌شده"
                  value={`${faNumber.format(result.summary.placedCount)} از ${faNumber.format(result.summary.totalParts)}`}
                  hint={
                    result.summary.unplacedCount > 0
                      ? `${faNumber.format(result.summary.unplacedCount)} قطعه جا نشد!`
                      : 'همهٔ قطعات چیده شدند'
                  }
                  accent={result.summary.unplacedCount > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-[var(--text)]'}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {result.sheets.map((sheet) => (
                  <span key={sheet.sheetIndex} className="badge text-sm">
                    صفحهٔ {faNumber.format(sheet.sheetIndex + 1)}: بهره‌وری{' '}
                    <b className="text-[var(--text)]">{faDecimal.format(sheet.utilizationPercentage)}٪</b>
                    {' · '}پرت {faDecimal.format(sheet.wastePercentage)}٪
                  </span>
                ))}
              </div>

              {result.sheets.length > 0 && (
                <CuttingMap
                  sheets={result.sheets}
                  stock={result.stock}
                  parts={resultParts}
                  sheetColor={settings.sheetColor}
                  bandColor={settings.bandColor}
                />
              )}

              {result.placements.length > 0 && (
                <section className="panel p-4 sm:p-5" aria-labelledby="labels-title">
                  <div className="flex flex-wrap items-center gap-2">
                    <div>
                      <span className="badge mb-2">لیبل‌ها</span>
                      <h3 id="labels-title" className="panel-title">
                        🏷️ لیبل قطعات برای کارگاه
                      </h3>
                    </div>
                    <span className="badge ms-auto text-sm">
                      {faNumber.format(result.placements.length)} لیبل · شبکهٔ ۳ × ۵ روی A4
                    </span>
                  </div>
                  <div className="table-scroll mt-4 overflow-x-auto rounded-2xl border-2 border-[var(--border)] bg-slate-300/70 p-3 dark:bg-slate-950/60">
                    <LabelSheet
                      placements={result.placements}
                      parts={resultParts}
                      bandColor={settings.bandColor}
                    />
                  </div>
                </section>
              )}

              {result.unplaced.length > 0 && (
                <div className="rounded-xl border-2 border-rose-400/70 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-800 dark:text-rose-200">
                  <p className="text-base font-black">
                    ⚠ این قطعات حتی در ورق خالی هم جا نمی‌شوند (در هیچ‌کدام از دو جهت):
                  </p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5">
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

              <p className="text-sm font-semibold leading-7 text-muted">
                مبدأ نقشه (۰،۰) گوشهٔ شروع ورق است. فاصله‌های باریک بین قطعات همان خوراک تیغه
                (Kerf) است. علامت هر عملیات دقیقاً روی همان لبه کشیده شده است: نوار رنگی، کانال
                دو خطی = شیار و خط دندانه‌ای = فارسی ۴۵°. برای دیدن جزئیات، روی هر قطعه مکث کنید.
              </p>
            </div>
          )}
        </section>
      )}

      {page === 'results' && (
        <section className="space-y-5" aria-labelledby="outputs-title">
          <div className="panel p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <span className="badge mb-2">خروجی‌ها · نتایج</span>
                <h2 id="outputs-title" className="panel-title">
                  نتایج، چاپ، PDF و DXF
                </h2>
                <p className="mt-1 text-sm font-semibold text-muted">
                  خلاصهٔ نتیجه به‌همراه خروجی چاپی/PDF نقشه و لیبل‌ها و فایل DXF برای CNC.
                </p>
              </div>
              <span className="badge ms-auto">مرحلهٔ ۳ از ۳</span>
            </div>

            {error && (
              <p className="mt-3 rounded-xl border-2 border-rose-400/60 bg-rose-500/10 px-4 py-3 text-base font-bold text-rose-700 dark:text-rose-200">
                ⚠ {error}
              </p>
            )}

            {!result && (
              <div className="empty-state mt-4">
                <p className="text-xl font-black text-[var(--text)]">هنوز خروجی‌ای آماده نیست</p>
                <p className="mt-2 text-base font-semibold">
                  ابتدا در صفحهٔ «داشبورد و تنظیمات» قطعات را وارد و «محاسبه» را اجرا کنید.
                </p>
              </div>
            )}
          </div>

          {result && (
            <>
              {isStale && (
                <p className="rounded-xl border-2 border-amber-400/70 bg-amber-500/12 px-4 py-3 text-base font-bold text-amber-800 dark:text-amber-200">
                  ⚠ نتیجهٔ فعلی قدیمی است. تا دوباره محاسبه نکنید، خروجی‌ها قفل می‌مانند تا نقشهٔ
                  اشتباه به کارگاه نرود.
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <ResultCard
                  title="ورق‌های مصرفی"
                  value={`${faNumber.format(result.summary.sheetCount)} صفحه`}
                  hint={`${result.stock.length} × ${result.stock.width} mm`}
                />
                <ResultCard
                  title="درصد پرت"
                  value={`${faDecimal.format(result.summary.wastePercentage)}٪`}
                  hint="شامل خوراک تیغه"
                  accent="text-rose-700 dark:text-rose-300"
                />
                <ResultCard
                  title="بهره‌وری"
                  value={`${faDecimal.format(result.summary.utilizationPercentage)}٪`}
                  hint="نسبت مساحت قطعات به ورق"
                  accent="text-emerald-700 dark:text-emerald-300"
                />
                <ResultCard
                  title="قطعات"
                  value={`${faNumber.format(result.summary.placedCount)} از ${faNumber.format(result.summary.totalParts)}`}
                  hint={result.summary.unplacedCount > 0 ? `${faNumber.format(result.summary.unplacedCount)} قطعه جا نشد` : 'همه چیده شدند'}
                  accent={result.summary.unplacedCount > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-[var(--text)]'}
                />
              </div>

              <div className="panel p-4 sm:p-5">
                <h3 className="panel-title">📤 دکمه‌های خروجی</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => requestDocument('map')}
                    disabled={isStale || pdfBusy}
                    title={
                      isStale
                        ? 'ابتدا دوباره محاسبه کنید'
                        : prefersPdf
                          ? 'ساخت PDF از نقشهٔ سیاه‌وسفید + فهرست گروه‌بندی‌شدهٔ قطعات و فاکتور متریال'
                          : 'چاپ نقشهٔ سیاه‌وسفید و فهرست گروه‌بندی‌شدهٔ قطعات + فاکتور متریال'
                    }
                    className="btn btn-primary py-4 text-base"
                  >
                    {pdfRequest === 'map'
                      ? '⏳ در حال ساخت PDF…'
                      : prefersPdf
                        ? '📄 دانلود PDF نقشه و لیست قطعات'
                        : '🖨️ چاپ نقشه و لیست قطعات'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadDxf}
                    disabled={isStale}
                    title={isStale ? 'ابتدا دوباره محاسبه کنید' : 'فایل DXF (R12) با لایه‌های CUT / GROOVE / FARSI_45 برای CNC'}
                    className="btn btn-secondary py-4 text-base"
                  >
                    ⬇️ دانلود DXF برای CNC
                  </button>
                  <button
                    type="button"
                    onClick={() => requestDocument('labels')}
                    disabled={isStale || pdfBusy}
                    title={
                      isStale
                        ? 'ابتدا دوباره محاسبه کنید'
                        : prefersPdf
                          ? 'ساخت PDF برچسب قطعات — شبکهٔ ۳×۵ روی A4'
                          : 'چاپ برچسب قطعات — شبکهٔ ۳×۵ روی A4'
                    }
                    className="btn btn-secondary py-4 text-base"
                  >
                    {pdfRequest === 'labels'
                      ? '⏳ در حال ساخت PDF…'
                      : prefersPdf
                        ? '📄 دانلود PDF لیبل‌ها'
                        : '🏷️ چاپ لیبل‌ها'}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowJson((v) => !v)}
                    className="btn btn-secondary"
                  >
                    {showJson ? 'پنهان‌کردن JSON' : 'مشاهدهٔ JSON خروجی'}
                  </button>
                  <button type="button" onClick={handleCopyJson} className="btn btn-secondary">
                    {copied ? '✓ کپی شد' : 'کپی JSON'}
                  </button>
                  <span className="text-sm font-semibold text-muted">
                    در DXF هر ورق کنار بعدی قرار می‌گیرد؛ کد هر قطعه (مثل S1-03) با لیبل چاپی‌اش یکی است.
                  </span>
                </div>

                {prefersPdf && (
                  <p className="mt-3 text-sm font-semibold leading-6 text-muted">
                    📄 چاپ مستقیم روی گوشی پشتیبانی نمی‌شود؛ دکمه‌های بالا فایل <b>PDF (A4)</b> می‌سازند
                    تا آن را ذخیره یا اشتراک‌گذاری کنید و از همان‌جا چاپ بگیرید.
                  </p>
                )}

                {pdfError && (
                  <p className="mt-3 rounded-xl border-2 border-rose-400/60 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-700 dark:text-rose-200">
                    ⚠ {pdfError}
                  </p>
                )}
              </div>

              {result.sheets.length > 0 && (
                <div className="panel p-4 sm:p-5">
                  <h3 className="panel-title">📋 برگهٔ کنترل تولید و فاکتور متریال</h3>
                  <ControlSheet result={result} parts={resultParts} />
                </div>
              )}

              {showJson && (
                <pre
                  dir="ltr"
                  className="max-h-[480px] overflow-auto rounded-2xl border-2 border-[var(--border)] bg-slate-950 p-4 text-left font-mono text-[12px] leading-6 text-emerald-200"
                >
                  {JSON.stringify(result, null, 2)}
                </pre>
              )}
            </>
          )}
        </section>
      )}

      {/*
        سند خروجی: از طریق Portal روی body رندر می‌شود و روی صفحه دیده نمی‌شود —
        در دسکتاپ برای چاپ (printMode) و در موبایل برای ضبط و تبدیل به PDF.
      */}
      {(printMode || pdfRequest) &&
        result &&
        createPortal(
          <div className="print-portal" ref={printPortalRef}>
            {(printMode ?? pdfRequest) === 'map' ? (
              <PrintMapDocument result={result} parts={resultParts} />
            ) : (
              <div className="print-doc-labels">
                <LabelSheet
                  placements={result.placements}
                  parts={resultParts}
                  bandColor={settings.bandColor}
                />
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  اجزای کوچک                                                         */
/* ------------------------------------------------------------------ */

function ColorField({
  label,
  hint,
  value,
  presets,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  presets: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="panel-soft p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="field-label mb-0">{label}</span>
        <span dir="ltr" className="badge font-mono text-xs">
          {value}
        </span>
      </div>
      <p className="mb-2 text-xs font-semibold text-subtle">{hint}</p>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="color-input max-w-24"
        />
        <div className="flex flex-wrap gap-1.5">
          {presets.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              aria-label={`${label}: ${color}`}
              title={color}
              className={`h-8 w-8 rounded-lg border-2 transition hover:scale-110 ${
                value.toLowerCase() === color.toLowerCase()
                  ? 'border-[var(--text)] ring-2 ring-[var(--accent)]'
                  : 'border-[var(--border)]'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * سند چاپی نقشهٔ برش: سربرگ خلاصه + نقشه‌ها + فهرست گروه‌بندی‌شدهٔ قطعات
 * و فاکتور متریال (بدون کنترل‌های تعاملی).
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
          <li>ضخامت نوار: <span dir="ltr" className="tabular-nums">{result.bandThickness ?? 0} mm</span> (از ابعاد نوارخورده کسر شده)</li>
          <li>صفحات مصرفی: {faNumber.format(summary.sheetCount)}</li>
          <li>بهره‌وری: {faDecimal.format(summary.utilizationPercentage)}٪</li>
          <li>پرت: {faDecimal.format(summary.wastePercentage)}٪</li>
          <li>
            قطعات: {faNumber.format(summary.placedCount)} از {faNumber.format(summary.totalParts)}
          </li>
        </ul>
      </header>
      <CuttingMap sheets={result.sheets} stock={result.stock} parts={parts} forPrint />
      <PrintPartsList result={result} parts={parts} />
    </div>
  );
}

function ResultCard({
  title,
  value,
  hint,
  accent = 'text-[var(--text)]',
}: {
  title: string;
  value: string;
  hint: string;
  accent?: string;
}) {
  return (
    <div className="stat-card">
      <p className="stat-label">{title}</p>
      <p className={`stat-value ${accent}`}>{value}</p>
      <p className="stat-hint">{hint}</p>
    </div>
  );
}
