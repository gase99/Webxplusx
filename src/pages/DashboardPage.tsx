import { TABS, type AppTab } from '../components/BottomNav';
import { variantLabel } from '../algorithm';
import { getAlgorithm } from '../engine/registry';
import { fa } from '../i18n/fa';
import type { PageProps } from './props';

const faNumber = new Intl.NumberFormat('fa-IR');
const faDecimal = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });

/**
 * A-Cut 2Dpro — صفحهٔ داشبورد
 * ==========================
 * نقطهٔ ورود برنامه (بدون هیچ نوار بالایی): کارت‌های وضعیت + میان‌بر شروع کار
 * + کارت‌های منو برای رفتن به چهار صفحهٔ اصلی. در اینجا هم می‌توان همان
 * «محاسبه» را زد تا کاربر لازم نباشد صفحه عوض کند.
 */
export default function DashboardPage({ app }: PageProps) {
  const { stats, engine, settings, rows, packing, currentProjectName, isDirty, currentProjectId } = app;
  const result = engine.result;
  const activeAlgorithm = getAlgorithm(packing.selection.id);
  const quickItems = TABS.filter((tab) => tab.id !== 'dashboard');

  return (
    <div className="space-y-4">
      {/* خوش‌آمد + وضعیت پروژه */}
      <section className="panel panel-accent overflow-hidden p-4 sm:p-6" aria-labelledby="dashboard-title">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0">
            <span className="badge mb-2">{fa.dashboard.title}</span>
            <h2 id="dashboard-title" className="section-title">
              {currentProjectName}
            </h2>
            <p className="mt-1 max-w-2xl text-sm font-semibold leading-7 text-muted">
              {fa.dashboard.subtitle}
            </p>
          </div>
          <span
            className={`badge ms-auto ${
              isDirty
                ? 'border-amber-400/70 bg-amber-500/15 text-amber-800 dark:text-amber-200'
                : 'border-emerald-400/70 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
            }`}
          >
            {isDirty ? fa.common.dirty : currentProjectId ? fa.common.saved : fa.common.autoDraft}
          </span>
        </div>

        {/* خلاصهٔ اعداد */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
          <StatCard title="ردیف معتبر" value={faNumber.format(stats.rowCount)} hint="دارای ابعاد کامل" />
          <StatCard title="مجموع قطعات" value={faNumber.format(stats.totalQty)} hint="با احتساب تعداد" />
          <StatCard
            title="مساحت برش"
            value={`${faDecimal.format(stats.totalAreaM2)} m²`}
            hint="پس از کسر نوار"
          />
          <StatCard
            title="ورق مصرفی"
            value={result ? `${faNumber.format(result.summary.sheetCount)} صفحه` : '—'}
            hint={result ? (engine.isStale ? fa.common.stale : fa.common.fresh) : fa.dashboard.noResult}
            accent="text-emerald-700 dark:text-emerald-300"
          />
          <StatCard
            title="پرت"
            value={result ? `${faDecimal.format(result.summary.wastePercentage)}٪` : '—'}
            hint="شامل خوراک تیغه"
            accent="text-rose-700 dark:text-rose-300"
          />
          <StatCard
            title="الگوریتم فعال"
            value={activeAlgorithm.label}
            hint={variantLabel(packing.selection.id, packing.selection.variant)}
            accent="text-violet-700 dark:text-violet-300"
          />
        </div>

        {/* دکمهٔ اصلی */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={engine.calculate}
            disabled={!engine.canCalculate || engine.busy}
            className="btn btn-success px-5 py-3 text-base"
          >
            {engine.busy ? '⏳ در حال محاسبه…' : `⚡ ${fa.dashboard.calculate}`}
          </button>
          {result && (
            <button type="button" onClick={() => app.setTab('map')} className="btn btn-primary px-4 py-3">
              {engine.isStale ? fa.common.recalculate : '🗺️ دیدن نقشه'}
            </button>
          )}
          <button type="button" onClick={() => app.setTab('parts')} className="btn btn-secondary px-4 py-3">
            ورود قطعات
          </button>
          <span className="text-xs font-semibold text-muted">
            ورق {faNumber.format(settings.stockLength)} × {faNumber.format(settings.stockWidth)} mm · تیغه{' '}
            {faNumber.format(settings.kerf)} mm
          </span>
        </div>

        {engine.error && (
          <p className="mt-3 rounded-xl border-2 border-rose-400/70 bg-rose-500/10 px-3 py-2 text-sm font-bold text-rose-800 dark:text-rose-200">
            ⚠ {engine.error}
          </p>
        )}
        {!engine.error && engine.warnings.length > 0 && (
          <ul className="mt-3 space-y-1 rounded-xl border-2 border-amber-400/70 bg-amber-500/12 px-3 py-2 text-sm font-bold text-amber-800 dark:text-amber-200">
            {engine.warnings.map((warning) => (
              <li key={warning}>⚠ {warning}</li>
            ))}
          </ul>
        )}
      </section>

      {/* کارت‌های منوی داشبورد — همان زبانه‌های نوار پایین، بزرگ‌تر */}
      <section aria-labelledby="quick-access-title" className="space-y-2">
        <h3 id="quick-access-title" className="px-1 text-lg font-black text-[var(--text)]">
          {fa.dashboard.quickStart}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickItems.map((item) => {
            const badge =
              item.id === 'parts'
                ? `${faNumber.format(stats.rowCount)} ردیف`
                : item.id === 'map' || item.id === 'results'
                  ? result
                    ? `${faNumber.format(result.summary.sheetCount)} ورق`
                    : 'بدون نتیجه'
                  : '';
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => app.setTab(item.id)}
                className="panel flex items-start gap-3 p-4 text-start transition hover:border-[var(--accent)] active:scale-[0.99]"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-3)] text-[var(--accent)]">
                  <QuickIcon tab={item.id} />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-base font-black text-[var(--text)]">{item.label}</span>
                    {badge && (
                      <span className="rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-[10px] font-black text-muted">
                        {badge}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs font-semibold leading-6 text-muted">{item.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* راهنمای سریع */}
      <section className="panel p-4 sm:p-5">
        <h3 className="panel-title">🧭 چطور شروع کنم؟</h3>
        <ol className="mt-2 grid gap-2 text-sm font-semibold leading-7 text-muted md:grid-cols-3">
          <li className="panel-soft p-3">
            <b className="text-[var(--text)]">۱) قطعات و ورق</b>
            <br />
            در صفحهٔ «قطعات» ابعاد ورق، تیغه و نوار را تنظیم و ردیف‌ها را وارد کنید.
          </li>
          <li className="panel-soft p-3">
            <b className="text-[var(--text)]">۲) الگوریتم و محاسبه</b>
            <br />
            در بخش «الگوریتم» روش چیدمان را انتخاب و «محاسبه» را بزنید.
          </li>
          <li className="panel-soft p-3">
            <b className="text-[var(--text)]">۳) نقشه و خروجی</b>
            <br />
            نقشه و لیبل را ببینید و از صفحهٔ «خروجی‌ها» PDF یا DXF بگیرید.
          </li>
        </ol>
        {rows.length === 0 && <p className="mt-2 text-sm font-bold text-amber-700 dark:text-amber-300">جدول قطعات خالی است.</p>}
      </section>
    </div>
  );
}

function StatCard({
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

function QuickIcon({ tab }: { tab: AppTab }) {
  const cls = 'h-6 w-6';
  if (tab === 'parts') {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 9h18M9 9v11M15 9v11" />
      </svg>
    );
  }
  if (tab === 'map') {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
        <path d="M2.5 10.5h8v9M10.5 4.5v6h11M14 10.5v9" />
      </svg>
    );
  }
  if (tab === 'results') {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M4 19V5M4 19h16" />
        <path d="M8 16l4-5 3 3 4-6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}
