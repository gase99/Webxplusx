import { useEffect, type ReactNode } from 'react';
import type { AppTheme } from './ThemeToggle';
import {
  ACCENT_OPTIONS,
  CORNER_OPTIONS,
  DEFAULT_UI_PREFS,
  HEADER_OPTIONS,
  MOTION_OPTIONS,
  type CornerStyle,
  type HeaderStyle,
  type MotionLevel,
  type UiPrefs,
} from '../uiPrefs';
import { MoonIcon, SunIcon, XIcon } from './icons';

interface AppearanceSheetProps {
  open: boolean;
  theme: AppTheme;
  uiPrefs: UiPrefs;
  onChange: (prefs: UiPrefs) => void;
  onThemeChange: (theme: AppTheme) => void;
  onClose: () => void;
}

/**
 * شیت «ظاهر و نوار بالا» — همان «تنظیمات تم و نوار و رنگ نوار».
 * تم روشن/تاریک، رنگ تأکید، ظاهر نوار بالا، گردی گوشه‌ها، سطح انیمیشن و
 * هایلایت چرخان دکمه‌ها همه از این‌جا کنترل می‌شوند و بلافاصله اعمال
 * می‌شوند (بدون نیاز به ذخیرهٔ پروژه).
 */
export default function AppearanceSheet({
  open,
  theme,
  uiPrefs,
  onChange,
  onThemeChange,
  onClose,
}: AppearanceSheetProps) {
  const patch = (next: Partial<UiPrefs>) => onChange({ ...uiPrefs, ...next });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-950/60 p-0 backdrop-blur-[3px] sm:items-start sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="appearance-title"
        className="app-menu mt-0 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl p-4 sm:mt-[5vh] sm:rounded-3xl sm:p-6"
      >
        <header className="flex items-start gap-3">
          <div className="min-w-0">
            <p className="page-eyebrow">تنظیمات ظاهری</p>
            <h2 id="appearance-title" className="panel-title">
              تم، نوار بالا و رنگ دکمه‌ها
            </h2>
            <p className="mt-1 text-sm font-bold text-muted">
              این تنظیمات فقط ظاهر برنامه را عوض می‌کند و روی محاسبهٔ برش اثری ندارد.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="ms-auto rounded-xl p-2 text-muted transition hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="mt-5 space-y-5">
          <FieldGroup title="تم برنامه" hint="روشن یا تاریک — قبل از بارگذاری صفحه هم اعمال می‌شود">
            <div className="grid gap-2 sm:grid-cols-2">
              <ChoiceCard
                active={theme === 'light'}
                onClick={() => onThemeChange('light')}
                title="روشن"
                hint="پس‌زمینهٔ روشن و متن تیرهٔ پرکنتراست"
                icon={<SunIcon className="h-5 w-5" />}
              />
              <ChoiceCard
                active={theme === 'dark'}
                onClick={() => onThemeChange('dark')}
                title="تاریک"
                hint="مناسب کارگاه کم‌نور و کار شبانه"
                icon={<MoonIcon className="h-5 w-5" />}
              />
            </div>
          </FieldGroup>

          <FieldGroup title="رنگ تأکید" hint="رنگ دکمه‌ها، حلقهٔ فعال و عناصر پررنگ">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {ACCENT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => patch({ accent: option.id })}
                  aria-pressed={uiPrefs.accent === option.id}
                  className={`panel-soft flex flex-col items-center gap-1.5 p-2 transition hover:-translate-y-0.5 ${
                    uiPrefs.accent === option.id
                      ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]'
                      : ''
                  }`}
                >
                  <span
                    className="h-8 w-full rounded-lg"
                    style={{
                      background: `linear-gradient(135deg, ${option.swatch[0]}, ${option.swatch[1]})`,
                    }}
                  />
                  <span className="text-xs font-black text-[var(--text)]">{option.label}</span>
                </button>
              ))}
            </div>
          </FieldGroup>

          <FieldGroup title="نوار بالا" hint="ظاهر هدر: شیشه‌ای، توپر، گرادیانی یا ساده">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {HEADER_OPTIONS.map((option) => (
                <ChoiceCard
                  key={option.id}
                  active={uiPrefs.header === option.id}
                  onClick={() => patch({ header: option.id as HeaderStyle })}
                  title={option.label}
                  hint={option.hint}
                  preview={<HeaderPreview style={option.id} />}
                />
              ))}
            </div>
          </FieldGroup>

          <div className="grid gap-5 lg:grid-cols-2">
            <FieldGroup title="گردی گوشه‌ها" hint="شکل کادرها و دکمه‌ها">
              <div className="grid gap-2">
                {CORNER_OPTIONS.map((option) => (
                  <ChoiceCard
                    key={option.id}
                    active={uiPrefs.corners === option.id}
                    onClick={() => patch({ corners: option.id as CornerStyle })}
                    title={option.label}
                    hint={option.hint}
                  />
                ))}
              </div>
            </FieldGroup>

            <FieldGroup title="کنتراست و حرکت" hint="خوانایی و انیمیشن‌ها">
              <div className="grid gap-2">
                {MOTION_OPTIONS.map((option) => (
                  <ChoiceCard
                    key={option.id}
                    active={uiPrefs.motion === option.id}
                    onClick={() => patch({ motion: option.id as MotionLevel })}
                    title={option.label}
                    hint={option.hint}
                  />
                ))}
              </div>
            </FieldGroup>
          </div>

          <label className="panel-soft flex cursor-pointer items-center gap-3 p-3">
            <input
              type="checkbox"
              checked={uiPrefs.ring}
              onChange={(e) => patch({ ring: e.target.checked })}
              className="h-5 w-5 accent-[var(--accent)]"
            />
            <span>
              <span className="block text-sm font-black text-[var(--text)]">
                هایلایت رنگی چرخان دور دکمه‌ها
              </span>
              <span className="block text-xs font-bold text-muted">
                یک حلقهٔ رنگی دور تا دور دکمه‌های اصلی می‌چرخد تا چشم سریع آن‌ها را پیدا کند.
              </span>
            </span>
          </label>
        </div>

        <footer className="mt-5 flex flex-wrap items-center gap-2">
          <button type="button" onClick={onClose} className="btn btn-primary accent-ring ms-auto">
            بستن و ادامهٔ کار
          </button>
          <button
            type="button"
            onClick={() => {
              onChange({ ...DEFAULT_UI_PREFS });
            }}
            className="btn btn-secondary"
          >
            بازگشت به پیش‌فرض
          </button>
        </footer>
      </div>
    </div>
  );
}

function FieldGroup({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
        <h3 className="text-base font-black text-[var(--text)]">{title}</h3>
        <p className="text-xs font-bold text-subtle">{hint}</p>
      </div>
      {children}
    </section>
  );
}

function ChoiceCard({
  active,
  onClick,
  title,
  hint,
  icon,
  preview,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  hint: string;
  icon?: ReactNode;
  preview?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`panel-soft flex items-start gap-2.5 p-3 text-start transition hover:-translate-y-0.5 ${
        active ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]' : ''
      }`}
    >
      {preview ?? <span className="text-[var(--accent)]">{icon}</span>}
      <span className="min-w-0">
        <span className="block text-sm font-black text-[var(--text)]">{title}</span>
        <span className="block text-[11px] font-bold leading-5 text-muted">{hint}</span>
      </span>
      {active && <span className="ms-auto text-sm font-black text-[var(--accent)]">✓</span>}
    </button>
  );
}

/** پیش‌نمایش کوچک هر سبک نوار بالا */
function HeaderPreview({ style }: { style: HeaderStyle }) {
  const base: Record<HeaderStyle, string> = {
    glass: 'bg-[var(--surface)]/90 border-b-2 border-[var(--border)]',
    solid: 'bg-[var(--accent)]',
    gradient: 'bg-[linear-gradient(90deg,var(--accent),var(--accent-2))]',
    minimal: 'bg-transparent border-b-2 border-[var(--border)]',
  };
  return (
    <span className="flex h-9 w-14 shrink-0 flex-col justify-between overflow-hidden rounded-md bg-[var(--surface-2)] p-0.5 ring-1 ring-[var(--border)]">
      <span className={`h-3 w-full rounded-sm ${base[style]}`} />
      <span className="mx-auto mb-0.5 h-1.5 w-8 rounded-full bg-[var(--border-strong)]" />
    </span>
  );
}

/** فقط برای دسترسی به نوع تنظیمات در فایل‌های دیگر */
export type { UiPrefs };
