import { useDeferredValue, useMemo } from 'react';
import DataEntryTable from '../components/DataEntryTable';
import ErrorBoundary from '../components/ErrorBoundary';
import LayoutPanel from '../components/LayoutPanel';
import PartPreview from '../components/PartPreview';
import {
  BandIcon,
  FarsiIcon,
  GrooveIcon,
} from '../components/icons';
import { isEmptyPart, isValidPart } from '../types/part';
import { fa } from '../i18n/fa';
import type { PageProps } from './props';

const faNumber = new Intl.NumberFormat('fa-IR');
const faDecimal = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });

/**
 * A-Cut 2Dpro — صفحهٔ «قطعات»
 * ===========================
 * تنظیمات ورق/تیغه/نوار + جدول ورود قطعات + پیش‌نمایش لبه‌ها + راهنمای علائم.
 * (همهٔ محتوای صفحهٔ داشبورد قبلی به این صفحه منتقل شده است.)
 */
export default function PartsPage({ app }: PageProps) {
  const { rows, setRows, activeId, setActiveId, settings, setSettings, layoutState, engine } = app;
  /**
   * عملکرد: تایپ در جدول نباید رندر پیش‌نمایش/شمارش را در هر کلید سنگین کند.
   * `useDeferredValue` بخش‌های غیرفوری (پیش‌نمایش و شمارش ناقص‌ها) را یک قدم
   * عقب‌تر نگه می‌دارد و در همین حال جدول فوری پاسخ می‌دهد.
   */
  const deferredRows = useDeferredValue(rows);
  const activePart = useMemo(
    () => deferredRows.find((row) => row.id === activeId) ?? deferredRows[0] ?? null,
    [deferredRows, activeId],
  );
  const incomplete = useMemo(
    () => deferredRows.filter((row) => !isEmptyPart(row) && !isValidPart(row)).length,
    [deferredRows],
  );

  return (
    <div className="space-y-4">
      <header className="space-y-1 px-1">
        <span className="badge">{fa.nav.parts}</span>
        <h2 className="section-title">{fa.parts.title}</h2>
        <p className="text-sm font-semibold leading-7 text-muted">{fa.parts.subtitle}</p>
      </header>

      {/* تنظیمات ورق، تیغه و نوار (همراه دکمهٔ محاسبه) */}
      <LayoutPanel
        page="parts"
        parts={rows}
        settings={settings}
        onSettingsChange={setSettings}
        engine={engine}
      />

      {incomplete > 0 && (
        <p className="rounded-xl border-2 border-amber-400/70 bg-amber-500/12 px-4 py-3 text-sm font-bold text-amber-800 dark:text-amber-200">
          ⚠ {faNumber.format(incomplete)} ردیف ناقص است (ابعاد یا تعداد کامل نشده) و در محاسبه لحاظ نمی‌شود.
        </p>
      )}

      {/* جدول ورود قطعات */}
      <section className="space-y-3" aria-labelledby="parts-entry-title">
        <div className="flex flex-wrap items-end gap-2 px-1">
          <div>
            <span className="badge mb-2">بخش قطعات</span>
            <h3 id="parts-entry-title" className="panel-title">
              ورود قطعات
            </h3>
          </div>
          <p className="ms-auto max-w-2xl text-sm font-semibold leading-7 text-muted">
            نام، طول، عرض و تعداد را وارد کنید؛ ستون‌های نوار، فارسی و شیار مقدار ۰/۱/۲ می‌گیرند.
            با Enter از هر فیلد به فیلد بعد و از «تعداد» به ردیف جدید می‌روید.
          </p>
        </div>

        {/* راهنمای ناوبری کیبورد */}
        <section className="panel flex flex-wrap items-center gap-x-2 gap-y-2 px-4 py-3">
          <span className="text-base font-extrabold text-[var(--text)]">⌨️ جریان ورود سریع:</span>
          <FlowChip label="نام قطعه" first />
          <EnterKey />
          <FlowChip label="طول" />
          <EnterKey />
          <FlowChip label="عرض" />
          <EnterKey />
          <FlowChip label="تعداد" />
          <EnterKey />
          <FlowChip label="ردیف جدید ✓" highlight />
          <span className="ms-auto text-sm font-semibold text-muted">
            جهت‌نمای <Kbd>↑</Kbd> <Kbd>↓</Kbd> بین ردیف‌ها حرکت می‌کند — ارقام فارسی هم پذیرفته می‌شوند.
          </span>
        </section>

        <ErrorBoundary label="جدول ورود قطعات">
          <DataEntryTable
            rows={rows}
            setRows={setRows}
            activeId={activeId}
            onActiveChange={setActiveId}
          />
        </ErrorBoundary>
      </section>

      {/* پیش‌نمایش + راهنمای علائم */}
      <section className="grid gap-4 lg:grid-cols-5">
        <div className="panel p-4 sm:p-5 lg:col-span-3">
          <h3 className="flex flex-wrap items-center justify-between gap-2 text-xl font-black text-[var(--text)]">
            پیش‌نمایش لبه‌های ردیف فعال
            <span className="badge text-xs">
              {activePart ? `«${activePart.name.trim() || 'بدون نام'}»` : ''}
            </span>
          </h3>
          <ErrorBoundary label="پیش‌نمایش قطعه">
            <PartPreview
              part={activePart}
              bandThickness={settings.bandThickness}
              sheetColor={settings.sheetColor}
              bandColor={settings.bandColor}
            />
          </ErrorBoundary>
          <p className="mt-2 text-center text-sm font-semibold leading-7 text-muted">
            در نقشهٔ برش همین عملیات روی خودِ لبه علامت می‌خورد. ابعاد برش پس از کسر ضخامت
            نوار/استریپ ({faNumber.format(settings.bandThickness)} mm) در پیش‌نمایش نمایش داده
            می‌شود.
          </p>
        </div>

        <div className="panel p-4 sm:p-5 lg:col-span-2">
          <h3 className="mb-3 text-xl font-black text-[var(--text)]">راهنمای علائم</h3>
          <ul className="space-y-3 text-base leading-7">
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 ring-2 ring-teal-300 dark:bg-teal-900/50 dark:ring-teal-600">
                <BandIcon active className="h-5 w-5" />
              </span>
              <p>
                <strong className="text-teal-800 dark:text-teal-200">نوار (لبه‌چسب PVC)</strong>
                <span className="text-subtle" dir="ltr"> — Edge Banding</span>
                <br />
                <span className="text-muted">
                  در نقشه با نوار رنگی روی همان لبه و حرف «ن» کنارش نشان داده می‌شود.
                </span>
              </p>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 ring-2 ring-rose-300 dark:bg-rose-900/50 dark:ring-rose-600">
                <FarsiIcon active className="h-5 w-5" />
              </span>
              <p>
                <strong className="text-rose-800 dark:text-rose-200">فارسی (برش ۴۵°)</strong>
                <span className="text-subtle" dir="ltr"> — Miter Cut</span>
                <br />
                <span className="text-muted">خط دندانه‌ای (زیگزاگ ۴۵°) روی همان لبه و حرف «ف».</span>
              </p>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 ring-2 ring-amber-300 dark:bg-amber-900/50 dark:ring-amber-600">
                <GrooveIcon active className="h-5 w-5" />
              </span>
              <p>
                <strong className="text-amber-800 dark:text-amber-200">شیار</strong>
                <span className="text-subtle"> — برای ورق ۳ میلی‌متری (پشت‌بند)</span>
                <br />
                <span className="text-muted">کانال دو خطی با حرف «ش» کنار لبه.</span>
              </p>
            </li>
          </ul>
          <p className="info-box mt-4 text-sm font-semibold leading-7">
            مقدار هر محور: ۰ بدون عملیات، ۱ یک لبه و ۲ هر دو لبهٔ مقابل است. «طول» لبه‌های موازی
            با طول قطعه و «عرض» لبه‌های موازی با عرض را مشخص می‌کند.
          </p>
        </div>
      </section>

      {layoutState && (
        <p className="px-1 text-xs font-semibold text-muted">
          آخرین محاسبه: {faNumber.format(layoutState.result.summary.sheetCount)} ورق · پرت{' '}
          {faDecimal.format(layoutState.result.summary.wastePercentage)}٪ —{' '}
          {engine.isStale ? 'با ورودی‌های فعلی هم‌خوان نیست.' : 'با ورودی‌های فعلی هم‌خوان است.'}
        </p>
      )}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border-2 border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 font-sans text-xs font-black text-[var(--text)]">
      {children}
    </kbd>
  );
}

function EnterKey() {
  return (
    <span className="inline-flex items-center gap-1 text-subtle" aria-hidden="true">
      <Kbd>Enter ↵</Kbd>
      <span className="text-base leading-none">←</span>
    </span>
  );
}

function FlowChip({
  label,
  highlight = false,
  first = false,
}: {
  label: string;
  highlight?: boolean;
  first?: boolean;
}) {
  return (
    <span
      className={`rounded-lg border-2 px-2.5 py-1 text-sm font-black ${
        highlight
          ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
          : first
            ? 'border-sky-500/60 bg-sky-500/15 text-sky-800 dark:text-sky-200'
            : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]'
      }`}
    >
      {label}
    </span>
  );
}
