import { MoonIcon, SunIcon } from './icons';

export type AppTheme = 'light' | 'dark';

interface ThemeToggleProps {
  theme: AppTheme;
  onToggle: () => void;
}

/**
 * دکمهٔ تغییر تم روشن/تاریک.
 * تم با کلاس `dark` روی <html> اعمال می‌شود و در localStorage نگه داشته
 * می‌شود؛ اسکریپت کوچک داخل index.html هم قبل از رندر، تم ذخیره‌شده را
 * اعمال می‌کند تا صفحه با فلش سفید/تیره باز نشود.
 */
export default function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const next = theme === 'dark' ? 'روشن' : 'تاریک';
  return (
    <button
      type="button"
      onClick={onToggle}
      className="theme-toggle"
      title={`تغییر به حالت ${next}`}
      aria-label={`تغییر به حالت ${next}`}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
