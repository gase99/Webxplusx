import { fa } from '../i18n/fa';

/**
 * A-Cut 2Dpro — نوار ناوبری پایین (Bottom Navigation)
 * ==================================================
 * - پنج زبانه: داشبورد، قطعات، نقشه، خروجی‌ها، بیشتر
 * - در چیدمان RTL، ترتیب زبانه‌ها از راست به چپ است (اولین زبانه = داشبورد در سمت راست)
 * - ارتفاع نوار + ناحیهٔ امن پایین دستگاه (gesture bar اندروید) با
 *   `env(safe-area-inset-bottom)` لحاظ می‌شود؛ محتوای صفحه هم padding
 *   پایین می‌گیرد تا زیر نوار نرود (کلاس `.app-content` در index.css).
 * - روی نمایشگر بزرگ (lg به بالا) نوار مخفی می‌شود؛ همان منو در همهٔ
 *   صفحه‌ها به‌صورت زبانه‌های بالای محتوا در دسترس است.
 */

export type AppTab = 'dashboard' | 'parts' | 'map' | 'results' | 'more';

export interface TabDefinition {
  id: AppTab;
  label: string;
  hint: string;
}

const iconClass = 'h-6 w-6';

export function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

export function PartsIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11M15 9v11" />
    </svg>
  );
}

export function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
      <path d="M2.5 10.5h8v9M10.5 4.5v6h11M14 10.5v9" />
    </svg>
  );
}

export function ResultsIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19V5M4 19h16" />
      <path d="M8 16l4-5 3 3 4-6" />
    </svg>
  );
}

export function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

/** ترتیب زبانه‌ها همان ترتیب RTL نوار است */
export const TABS: TabDefinition[] = [
  { id: 'dashboard', label: fa.nav.dashboard, hint: fa.nav.dashboardHint },
  { id: 'parts', label: fa.nav.parts, hint: fa.nav.partsHint },
  { id: 'map', label: fa.nav.map, hint: fa.nav.mapHint },
  { id: 'results', label: fa.nav.results, hint: fa.nav.resultsHint },
  { id: 'more', label: fa.nav.more, hint: fa.nav.moreHint },
];

/** نگاشت شناسهٔ زبانه به کامپوننت آیکون */
export function TabIcon({ tab }: { tab: AppTab }) {
  switch (tab) {
    case 'parts':
      return <PartsIcon />;
    case 'map':
      return <MapIcon />;
    case 'results':
      return <ResultsIcon />;
    case 'more':
      return <MoreIcon />;
    case 'dashboard':
    default:
      return <DashboardIcon />;
  }
}

interface BottomNavProps {
  active: AppTab;
  onChange: (tab: AppTab) => void;
  /** نشان کوچک روی زبانه‌ها (مثلاً تعداد قطعات معتبر یا «نتیجه قدیمی») */
  badges?: Partial<Record<AppTab, string>>;
}

export default function BottomNav({ active, onChange, badges }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label={fa.nav.aria}>
      <ul className="bottom-nav-inner">
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          const badge = badges?.[tab.id];
          return (
            <li key={tab.id} className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onChange(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={`${tab.label} — ${tab.hint}`}
                data-tab={tab.id}
                className={`bottom-nav-item ${isActive ? 'is-active' : ''}`}
              >
                <span className="bottom-nav-icon">
                  <TabIcon tab={tab.id} />
                  {badge && <span className="bottom-nav-badge">{badge}</span>}
                </span>
                <span className="bottom-nav-label">{tab.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
