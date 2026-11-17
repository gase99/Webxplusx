import type { CSSProperties } from 'react';
import { PAGES, type AppPage } from '../types/pages';

interface PageNavProps {
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
}

/**
 * نوار صفحه‌ها — هر صفحه یک تب مستقل با رنگ خودش.
 * هر چیزی که «فعال» است، دورش حلقهٔ رنگی چرخان دارد (کلاس accent-ring).
 */
export default function PageNav({ activePage, onNavigate }: PageNavProps) {
  return (
    <nav aria-label="صفحه‌های برنامه" className="panel p-2 sm:p-2.5">
      <ol className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        {PAGES.map((page) => {
          const isActive = activePage === page.id;
          return (
            <li key={page.id}>
              <button
                type="button"
                onClick={() => onNavigate(page.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`page-tab ${isActive ? 'accent-ring' : ''}`}
                style={{ '--tab': page.color } as CSSProperties}
              >
                <span className="page-tab-num">{page.number}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-black leading-tight">
                    {page.label}
                  </span>
                  <span className="block truncate text-[11px] font-bold text-subtle">
                    {page.hint}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
