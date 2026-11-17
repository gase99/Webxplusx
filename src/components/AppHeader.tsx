import { useEffect, useRef, useState } from 'react';
import type { AppPage, PageMeta } from '../types/pages';
import type { AppTheme } from './ThemeToggle';
import { PAGES } from '../types/pages';
import { ACCENT_OPTIONS, type UiPrefs } from '../uiPrefs';
import ThemeToggle from './ThemeToggle';
import InstallButton from './InstallButton';
import { DotsIcon, FolderOpenIcon, InfoIcon, MoonIcon, PaletteIcon, SunIcon } from './icons';

interface AppHeaderProps {
  page: AppPage;
  projectName: string;
  onOpenProjects: () => void;
  isDirty: boolean;
  theme: AppTheme;
  uiPrefs: UiPrefs;
  onToggleTheme: () => void;
  onNavigate: (page: AppPage) => void;
  onOpenSettings: () => void;
  onSetAccent: (accent: UiPrefs['accent']) => void;
  onToggleRing: () => void;
  onToggleMotion: () => void;
}

/**
 * نوار بالای برنامه — سبک داشبورد
 * ------------------------------------------------------------------
 * کادر/جعبهٔ عنوان «A-Cut 2Dpro» برداشته شده و فقط نام صفحهٔ فعال با
 * تیتر درشت و کنتراست بالا دیده می‌شود. همهٔ ابزارها (تم، تنظیمات ظاهری،
 * پروژه و صفحه‌ها) داخل منوی «⋮» جمع شده‌اند تا بالای صفحه خلوت بماند.
 */
export default function AppHeader({
  page,
  projectName,
  isDirty,
  theme,
  uiPrefs,
  onToggleTheme,
  onNavigate,
  onOpenSettings,
  onSetAccent,
  onToggleRing,
  onToggleMotion,
  onOpenProjects,
}: AppHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const current = PAGES.find((item) => item.id === page) ?? PAGES[0];

  // بستن منو با کلیک بیرون، Escape و تغییر صفحه
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const go = (target: AppPage) => () => {
    setMenuOpen(false);
    onNavigate(target);
  };

  const runMenu = (fn: () => void) => () => {
    fn();
    setMenuOpen(false);
  };

  const menuItem =
    'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-sm font-extrabold text-[var(--text)] transition hover:bg-[var(--surface-3)]';

  return (
    <header className="app-header sticky top-0 z-40">
      <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-3 sm:px-6">
        {/* تیتر صفحهٔ فعال — بدون کادر لوگو و نام برند */}
        <div className="min-w-0 leading-tight">
          <p className="page-eyebrow">صفحهٔ {current.number} از ۴</p>
          <h1 className="truncate text-xl font-black tracking-tight text-[var(--text)] sm:text-2xl">
            {current.title}
          </h1>
        </div>

        <p
          className="ms-2 hidden max-w-[280px] truncate text-sm font-bold text-muted xl:block"
          title={projectName}
        >
          {projectName}
          <span
            className={`ms-2 inline-block h-2 w-2 rounded-full align-middle ${
              isDirty ? 'bg-amber-400' : 'bg-emerald-400'
            }`}
            title={isDirty ? 'تغییرات ذخیره‌نشده' : 'ذخیره‌شده'}
          />
        </p>

        <div className="ms-auto flex items-center gap-2">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <InstallButton />

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="منوی تنظیمات و صفحه‌ها"
              title="تنظیمات ظاهری و جابه‌جایی صفحه‌ها"
              className={`dots-button ${menuOpen ? 'dots-button-open' : ''}`}
            >
              <DotsIcon className="h-6 w-6" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="app-menu absolute end-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl p-2"
              >
                <p className="px-3 pb-1 pt-1 text-[11px] font-black text-subtle">تنظیمات ظاهری</p>

                <div className="px-2 pb-2">
                  <p className="mb-1.5 text-xs font-extrabold text-muted">رنگ تأکید برنامه</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ACCENT_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => onSetAccent(option.id)}
                        aria-pressed={uiPrefs.accent === option.id}
                        aria-label={`رنگ ${option.label}`}
                        title={option.label}
                        className={`h-7 w-7 rounded-full border-2 transition hover:scale-110 ${
                          uiPrefs.accent === option.id
                            ? 'border-[var(--text)] ring-2 ring-[var(--accent)]'
                            : 'border-[var(--border)]'
                        }`}
                        style={{
                          background: `linear-gradient(135deg, ${option.swatch[0]}, ${option.swatch[1]})`,
                        }}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  role="menuitem"
                  className={menuItem}
                  onClick={runMenu(onToggleTheme)}
                >
                  {theme === 'dark' ? (
                    <SunIcon className="h-5 w-5" />
                  ) : (
                    <MoonIcon className="h-5 w-5" />
                  )}
                  {theme === 'dark' ? 'تم روشن' : 'تم تاریک'}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={menuItem}
                  onClick={runMenu(onToggleRing)}
                >
                  <span className="flex h-5 w-5 items-center justify-center text-base leading-none">
                    ◎
                  </span>
                  <span className="flex-1">هایلایت چرخان دکمه‌ها</span>
                  <Switch on={uiPrefs.ring} />
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={menuItem}
                  onClick={runMenu(onToggleMotion)}
                >
                  <span className="flex h-5 w-5 items-center justify-center text-base leading-none">
                    ✧
                  </span>
                  <span className="flex-1">انیمیشن</span>
                  <span className="badge text-[10px]">
                    {uiPrefs.motion === 'full'
                      ? 'کامل'
                      : uiPrefs.motion === 'soft'
                        ? 'ملایم'
                        : 'خاموش'}
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={menuItem}
                  onClick={runMenu(onOpenSettings)}
                >
                  <PaletteIcon className="h-5 w-5" />
                  ظاهر و نوار بالا…
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={menuItem}
                  onClick={runMenu(onOpenProjects)}
                >
                  <FolderOpenIcon className="h-5 w-5" />
                  پروژه‌های ذخیره‌شده
                </button>

                <div className="mx-2 my-2 border-t border-[var(--border)]" />
                <p className="px-3 pb-1 text-[11px] font-black text-subtle">صفحه‌ها</p>
                {PAGES.map((item: PageMeta) => (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    onClick={go(item.id)}
                    aria-current={page === item.id ? 'page' : undefined}
                    className={`${menuItem} ${page === item.id ? 'bg-[var(--surface-3)]' : ''}`}
                  >
                    <span
                      className="grid h-6 w-6 place-items-center rounded-lg text-[11px] font-black text-white"
                      style={{ backgroundColor: item.color }}
                    >
                      {item.number}
                    </span>
                    <span className="flex-1 truncate">{item.title}</span>
                    {page === item.id && (
                      <span className="text-xs font-black text-[var(--accent)]">●</span>
                    )}
                  </button>
                ))}

                <div className="mx-2 my-2 border-t border-[var(--border)]" />
                <button type="button" role="menuitem" className={menuItem} onClick={go('guide')}>
                  <InfoIcon className="h-5 w-5" />
                  راهنمای صفحه‌ها
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
        on ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]'
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
          on ? 'start-0.5' : 'end-0.5'
        }`}
      />
    </span>
  );
}
