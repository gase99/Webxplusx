import type { ReactNode } from 'react';
import { PAGES, getAdjacentPage, type AppPage } from '../types/pages';

interface PageRailProps {
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
}

/**
 * نوار راهنمای پایین صفحه — «راهنمای صفحات»
 * ------------------------------------------------------------------
 * چهار درِ جداگانه برای چهار صفحه، بدون هیچ محتوای مشترکی. صفحهٔ فعال با
 * حلقهٔ رنگی چرخان مشخص می‌شود و متن راهنما بالای نوار هرگز توسط نوار
 * شناور پنهان نمی‌شود (بدنهٔ صفحه padding-bottom مخصوص دارد).
 */
export default function PageRail({ activePage, onNavigate }: PageRailProps) {
  return (
    <nav className="page-rail print:hidden" aria-label="راهنمای صفحه‌ها">
      <div className="page-rail-inner">
        <div className="page-rail-caption">
          <span className="page-rail-title">راهنمای صفحه‌ها</span>
          <span className="hidden text-[11px] font-bold text-subtle sm:inline">
            هر صفحه مستقل است — با دکمهٔ «⋮» بالا هم می‌توانید جابه‌جا شوید
          </span>
        </div>
        <ol className="page-rail-list">
          {PAGES.map((page) => {
            const isActive = activePage === page.id;
            return (
              <li key={page.id}>
                <button
                  type="button"
                  onClick={() => onNavigate(page.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`page-rail-item ${isActive ? 'page-rail-item-active accent-ring' : ''}`}
                >
                  <span className="page-rail-num">{page.number}</span>
                  <span className="page-rail-text">
                    <span className="page-rail-label">{page.label}</span>
                    <span className="page-rail-hint">{page.hint}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

/** ردیف دکمه‌های «صفحهٔ قبلی/بعدی» در انتهای هر صفحه */
export function PageStepper({
  activePage,
  onNavigate,
  extra,
}: {
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
  extra?: ReactNode;
}) {
  const prev = getAdjacentPage(activePage, -1);
  const next = getAdjacentPage(activePage, 1);
  return (
    <div className="panel flex flex-wrap items-center gap-2 p-3">
      <button
        type="button"
        onClick={() => onNavigate(prev.id)}
        className="btn btn-secondary accent-ring"
      >
        <span aria-hidden="true">→</span> صفحهٔ قبل: {prev.label}
      </button>
      <button
        type="button"
        onClick={() => onNavigate(next.id)}
        className="btn btn-primary accent-ring"
      >
        صفحهٔ بعد: {next.label} <span aria-hidden="true">←</span>
      </button>
      {extra && <div className="ms-auto flex flex-wrap items-center gap-2">{extra}</div>}
    </div>
  );
}
