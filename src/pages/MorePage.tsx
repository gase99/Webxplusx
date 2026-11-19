import { useEffect, useState } from 'react';
import AlgorithmPicker from '../components/AlgorithmPicker';
import ErrorBoundary from '../components/ErrorBoundary';
import InstallButton from '../components/InstallButton';
import ThemeToggle from '../components/ThemeToggle';
import { ProjectListPanel } from '../components/ProjectManager';
import { DXF_SHEET_GAP_MM, GROOVE_INSET_MM, UPDATE_CHECK_INTERVAL_MS } from '../config/constants';
import { estimateStorage } from '../db/database';
import { logger, type LogRecord } from '../lib/logger';
import { fa } from '../i18n/fa';
import type { PageProps } from './props';

const faNumber = new Intl.NumberFormat('fa-IR');
const faDecimal = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });

/**
 * A-Cut 2Dpro — صفحهٔ «بیشتر»
 * ===========================
 * همهٔ موارد ثانویه و پیشرفته که نباید جریان کاری اصلی را شلوغ کنند:
 *  - انتخاب الگوریتم و گزینه‌های پیشرفتهٔ چیدمان (سقف ورق، تکرار، بذر)
 *  - پروژه‌های ذخیره‌شده (بازکردن/ذخیره/حذف)
 *  - ظاهر (تم)، نصب برنامه، بروزرسانی نسخه
 *  - راهنما و قوانین محاسبه
 *  - ابزارهای تشخیصی: لاگ رخدادها، برآورد حافظه، ثابت‌های کارگاهی
 */
export default function MorePage({ app }: PageProps) {
  const {
    packing,
    setSelection,
    setMaxSheets,
    setAutoRecalculate,
    theme,
    toggleTheme,
    projects,
    currentProjectId,
    currentProjectName,
    isDirty,
    saveProject,
    newProject,
    openProject,
    deleteProject,
    dbError,
    clearDbError,
  } = app;

  const [showProjects, setShowProjects] = useState(false);

  return (
    <div className="space-y-4">
      <header className="space-y-1 px-1">
        <span className="badge">{fa.nav.more}</span>
        <h2 className="section-title">{fa.more.title}</h2>
        <p className="text-sm font-semibold leading-7 text-muted">{fa.more.subtitle}</p>
      </header>

      {dbError && (
        <div role="alert" className="rounded-xl border-2 border-rose-400/70 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-800 dark:text-rose-200">
          <p>⚠ {dbError.userMessage}</p>
          <p className="mt-1 text-[11px] font-semibold opacity-80" dir="ltr">
            {dbError.message}
          </p>
          <button type="button" className="btn btn-secondary mt-2 px-3 py-1 text-xs" onClick={clearDbError}>
            بستن پیام
          </button>
        </div>
      )}

      {/* الگوریتم‌ها و گزینه‌های پیشرفته */}
      <ErrorBoundary label="تنظیمات الگوریتم">
        <AlgorithmPicker
          selection={packing.selection}
          onChange={setSelection}
          maxSheets={packing.maxSheets}
          onMaxSheetsChange={setMaxSheets}
        />
      </ErrorBoundary>

      <section className="panel p-4 sm:p-5">
        <h3 className="panel-title">⚙️ رفتار محاسبه</h3>
        <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border-2 border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 accent-cyan-600"
            checked={packing.autoRecalculate}
            onChange={(event) => setAutoRecalculate(event.target.checked)}
          />
          <span>
            <span className="block text-base font-black text-[var(--text)]">محاسبهٔ خودکار پس از تغییر</span>
            <span className="block text-sm font-semibold text-muted">
              با هر تغییر در قطعات یا تنظیمات، چیدمان بعد از ۷۰۰ میلی‌ثانیه سکوت دوباره محاسبه می‌شود.
              برای قطعات زیاد و حالت بهینه‌ساز بهتر است خاموش بماند.
            </span>
          </span>
        </label>
      </section>

      {/* پروژه‌ها */}
      <section className="panel p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <span className="badge mb-2">پروژه</span>
            <h3 className="panel-title">پروژه‌های ذخیره‌شده</h3>
            <p className="mt-1 text-sm font-semibold text-muted">
              {currentProjectName} — {faNumber.format(projects.length)} پروژه روی این دستگاه
            </p>
          </div>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-primary" onClick={() => saveProject(false)}>
              💾 ذخیره
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => saveProject(true)}>
              ذخیره با نام جدید
            </button>
            <button type="button" className="btn btn-secondary" onClick={newProject}>
              پروژهٔ جدید
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowProjects((v) => !v)}>
              {showProjects ? 'بستن فهرست' : 'فهرست پروژه‌ها'}
            </button>
          </div>
        </div>
        {showProjects && (
          <div className="mt-3">
            <ErrorBoundary label="پروژه‌های ذخیره‌شده">
              <ProjectListPanel
                projects={projects}
                currentProjectId={currentProjectId}
                onOpen={openProject}
                onDelete={deleteProject}
              />
            </ErrorBoundary>
          </div>
        )}
        {!showProjects && (
          <p className="mt-2 text-xs font-semibold text-muted">
            {isDirty ? 'تغییرات فعلی ذخیره نشده است.' : 'همهٔ تغییرات ذخیره شده است.'}
          </p>
        )}
      </section>

      {/* ظاهر، نصب، بروزرسانی */}
      <section className="panel p-4 sm:p-5">
        <h3 className="panel-title">🎨 ظاهر و نصب</h3>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-muted">تم فعلی: {theme === 'dark' ? 'تاریک' : 'روشن'}</span>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <InstallButton />
          <button type="button" className="btn btn-secondary" onClick={checkForUpdate}>
            🔄 {fa.more.updateCheck}
          </button>
        </div>
        <p className="mt-2 text-xs font-semibold leading-6 text-muted">
          نسخهٔ جدید به‌طور خودکار هر {faNumber.format(Math.round(UPDATE_CHECK_INTERVAL_MS / 60000))} دقیقه و
          هنگام بازگشت به برنامه بررسی می‌شود؛ پیام «نسخهٔ جدید آماده است» پایین صفحه ظاهر می‌شود.
        </p>
        <UpdateStatus />
      </section>

      {/* راهنما */}
      <GuideSection />

      {/* ابزارهای تشخیصی */}
      <DiagnosticsSection />

      <section className="panel p-4 sm:p-5">
        <h3 className="panel-title">ℹ️ {fa.more.about}</h3>
        <p className="mt-2 text-sm font-semibold leading-7 text-muted">
          <b dir="ltr" className="text-[var(--text)]">A-Cut 2Dpro</b> — {fa.app.tagline}؛ {fa.app.designerRole}:{' '}
          <b className="text-[var(--text)]">{fa.app.designer}</b>. پروژه‌ها در IndexedDB همین مرورگر ذخیره
          می‌شوند، فضای کاری خودکار نگه داشته می‌شود و نسخهٔ وب/اندروید/ویندوز از همین رابط استفاده می‌کنند.
        </p>
        <p className="mt-2 flex flex-wrap gap-2 text-sm font-bold">
          <a
            href="https://instagram.com/Webxplusx"
            target="_blank"
            rel="noreferrer"
            className="panel-soft px-3 py-1.5 text-[var(--text)] transition hover:text-pink-600"
          >
            {fa.app.instagram} @Webxplusx
          </a>
          <a
            href="https://t.me/Webxplusx"
            target="_blank"
            rel="noreferrer"
            className="panel-soft px-3 py-1.5 text-[var(--text)] transition hover:text-sky-600"
          >
            {fa.app.telegram} @Webxplusx
          </a>
        </p>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  بروزرسانی                                                          */
/* ------------------------------------------------------------------ */

async function checkForUpdate(): Promise<void> {
  // اعلان بروزرسانی (UpdateToast) با این رویداد خنک‌شدن «بعداً» را نادیده می‌گیرد
  window.dispatchEvent(new Event('acut:check-update'));
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (!registration) {
      window.alert('سرویس‌ورکر در این محیط فعال نیست (نسخهٔ بومی/نصب‌شده همیشه آخرین نسخه را دارد).');
      return;
    }
    await registration.update();
    logger.info('بررسی دستی نسخهٔ جدید انجام شد');
  } catch (error) {
    logger.warn('بررسی نسخهٔ جدید ناموفق بود (احتمالاً آفلاین)', error);
  }
}

function UpdateStatus() {
  const [status, setStatus] = useState<string>('—');
  useEffect(() => {
    let alive = true;
    navigator.serviceWorker
      ?.getRegistration()
      .then((registration) => {
        if (!alive) return;
        setStatus(registration ? 'سرویس‌ورکر فعال — کار آفلاین و بروزرسانی خودکار' : 'سرویس‌ورکر غیرفعال (نسخهٔ بومی)');
      })
      .catch(() => alive && setStatus('وضعیت سرویس‌ورکر نامشخص'));
    return () => {
      alive = false;
    };
  }, []);
  return <p className="mt-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">وضعیت: {status}</p>;
}

/* ------------------------------------------------------------------ */
/*  راهنما                                                             */
/* ------------------------------------------------------------------ */

function GuideSection() {
  return (
    <section className="panel p-4 sm:p-5" aria-labelledby="guide-title">
      <h3 id="guide-title" className="panel-title">
        📘 {fa.more.guide}
      </h3>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="panel-soft p-3">
          <p className="text-base font-black text-[var(--text)]">📐 قانون کسر ضخامت نوار</p>
          <p className="mt-1 text-sm font-semibold leading-7 text-muted">
            ضخامت نوار از بعد عمود بر لبهٔ نوارخورده کم می‌شود (در چیدمان، نقشه، لیبل، DXF و محاسبهٔ
            پرت یکسان اعمال می‌شود). خوراک تیغه (Kerf) از فضای باقی‌ماندهٔ ورق کم می‌شود، نه از ابعاد
            قطعه.
          </p>
        </div>
        <div className="panel-soft p-3">
          <p className="text-base font-black text-[var(--text)]">🧠 الگوریتم‌ها به زبان ساده</p>
          <ul className="mt-1 space-y-0.5 text-sm font-semibold leading-7 text-muted">
            <li>• گیلوتینی: برش‌های سرتاسری، قابل اجرا روی ارهٔ پانل‌بُر.</li>
            <li>• MaxRects: کمترین پرت، مناسب CNC.</li>
            <li>• Skyline: ردیفی روی «خط آسمان»، سریع.</li>
            <li>• Shelf: ساده‌ترین حالت، مرجع مقایسه.</li>
            <li>• بهینه‌ساز: جستجوی هوشمند؛ با بذر و تکرار قابل بازتولید.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  ابزارهای تشخیصی                                                    */
/* ------------------------------------------------------------------ */

function DiagnosticsSection() {
  const [records, setRecords] = useState<readonly LogRecord[]>(() => logger.getRecords());
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);

  useEffect(() => {
    const unsubscribe = logger.subscribe((next) => setRecords([...next]));
    void estimateStorage().then(setStorage);
    return unsubscribe;
  }, []);

  return (
    <section className="panel p-4 sm:p-5" aria-labelledby="diagnostics-title">
      <h3 id="diagnostics-title" className="panel-title">
        🧰 {fa.more.diagnostics}
      </h3>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm font-semibold sm:grid-cols-4">
        <div className="panel-soft p-2">
          <dt className="text-[11px] font-black text-subtle">فاصلهٔ خط شیار</dt>
          <dd dir="ltr" className="font-black tabular-nums">{GROOVE_INSET_MM} mm</dd>
        </div>
        <div className="panel-soft p-2">
          <dt className="text-[11px] font-black text-subtle">فاصلهٔ ورق‌ها در DXF</dt>
          <dd dir="ltr" className="font-black tabular-nums">{DXF_SHEET_GAP_MM} mm</dd>
        </div>
        <div className="panel-soft p-2">
          <dt className="text-[11px] font-black text-subtle">حافظهٔ مصرف‌شده</dt>
          <dd dir="ltr" className="font-black tabular-nums">
            {storage ? `${faDecimal.format(storage.usage / 1024 / 1024)} MB` : '—'}
          </dd>
        </div>
        <div className="panel-soft p-2">
          <dt className="text-[11px] font-black text-subtle">سهمیهٔ مرورگر</dt>
          <dd dir="ltr" className="font-black tabular-nums">
            {storage ? `${faDecimal.format(storage.quota / 1024 / 1024 / 1024)} GB` : '—'}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-black text-[var(--text)]">
          {fa.more.logs} ({faNumber.format(records.length)})
        </span>
        <button type="button" className="btn btn-secondary ms-auto px-3 py-1 text-xs" onClick={() => logger.clear()}>
          {fa.more.clearLogs}
        </button>
      </div>
      <div className="mt-2 max-h-56 overflow-auto rounded-xl border-2 border-[var(--border)] bg-[var(--surface-2)] p-2">
        {records.length === 0 ? (
          <p className="p-2 text-xs font-semibold text-muted">رخدادی ثبت نشده است.</p>
        ) : (
          <ul className="space-y-1 text-[11px] font-semibold" dir="ltr">
            {[...records].reverse().map((record, index) => (
              <li key={`${record.timestamp}-${index}`} className="flex gap-2 border-b border-[var(--border)] pb-1 last:border-0">
                <span
                  className={`shrink-0 font-black ${
                    record.level === 'error'
                      ? 'text-rose-600 dark:text-rose-300'
                      : record.level === 'warn'
                        ? 'text-amber-600 dark:text-amber-300'
                        : 'text-sky-700 dark:text-sky-300'
                  }`}
                >
                  {record.level.toUpperCase()}
                </span>
                <span className="shrink-0 tabular-nums text-subtle">
                  {new Date(record.timestamp).toLocaleTimeString('fa-IR')}
                </span>
                <span className="min-w-0 break-words text-[var(--text)]">
                  {record.message}
                  {record.detail ? ` — ${record.detail}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
