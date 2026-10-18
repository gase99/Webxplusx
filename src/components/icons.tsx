interface IconProps {
  className?: string;
  /** در حالت فعال (چک‌باکس تیک‌خورده) رنگ پررنگ‌تر می‌شود */
  active?: boolean;
}

/**
 * آیکون «فارسی» — مثلث قائم‌الزاویه با وتر مورب قرمز و قوس زاویه.
 * کنار چک‌باکس‌های ستون فارسی قرار می‌گیرد تا کاربر ببیند این گزینه
 * در خروجی (نقشهٔ برش، فاز ۳) با خط قرمز/هاشور و برچسب ۴۵° نمایش داده می‌شود.
 */
export function FarsiIcon({ className = 'h-[18px] w-[18px]', active = false }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true" focusable="false">
      <title>برش فارسی ۴۵ درجه</title>
      {/* بدنهٔ مثلث */}
      <path
        d="M3 17 L17 17 L17 3 Z"
        fill={active ? '#fecdd3' : '#f1f5f9'}
        stroke={active ? '#e11d48' : '#94a3b8'}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* وتر مورب = خط برش ۴۵ درجه (در نقشه قرمز رسم می‌شود) */}
      <path
        d="M3 17 L17 3"
        stroke="#e11d48"
        strokeWidth={active ? 2.2 : 1.4}
        strokeLinecap="round"
      />
      {/* هاشور کوتاه عمود بر خط برش */}
      <path
        d="M7.2 10.4 l-2.2 -0.4 M10 7.6 l-2.2 -0.4 M12.8 4.8 l-2.2 -0.4"
        stroke="#e11d48"
        strokeWidth="1"
        strokeLinecap="round"
        opacity={active ? 1 : 0.45}
      />
      {/* قوس زاویهٔ ۴۵ درجه */}
      <path
        d="M13 17 A4 4 0 0 0 14.2 14.2"
        fill="none"
        stroke={active ? '#e11d48' : '#94a3b8'}
        strokeWidth="1"
      />
    </svg>
  );
}

/** آیکون «نوار» — خط ضخیم روی لبه (لبه‌چسب PVC) */
export function BandIcon({ className = 'h-[18px] w-[18px]', active = false }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true" focusable="false">
      <title>نوار لبه (Edge Banding)</title>
      <rect x="3" y="6" width="14" height="11" rx="1" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" />
      <path
        d="M3 6 H17"
        stroke={active ? '#0f766e' : '#14b8a6'}
        strokeWidth="3.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** آیکون «شیار» — خط‌چین موازی لبه (محل ورق ۳ میلی‌متری) */
export function GrooveIcon({ className = 'h-[18px] w-[18px]', active = false }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true" focusable="false">
      <title>شیار ورق ۳ میلی‌متری</title>
      <rect x="3" y="4" width="14" height="13" rx="1" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" />
      <path
        d="M5 8 H15"
        stroke={active ? '#b45309' : '#f59e0b'}
        strokeWidth="2"
        strokeDasharray="3 2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TrashIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6h12ZM10 11v6M14 11v6" />
    </svg>
  );
}

export function CopyIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 8h12v12H8zM4 4h12v12" />
    </svg>
  );
}

export function PlusIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className={className} aria-hidden="true">
      <path strokeLinecap="round" d="M12 4v16M4 12h16" />
    </svg>
  );
}

/** لوگوی سادهٔ نرم‌افزار: تیغهٔ برش دایره‌ای */
export function LogoIcon({ className = 'h-7 w-7' }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="15" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="6 4" />
      <circle cx="24" cy="24" r="5" fill="currentColor" />
      <path d="M4 40 H44" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function SaveIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3h11l3 3v15H5z M8 3v5h7V3 M8 21v-7h8v7" />
    </svg>
  );
}

export function FolderOpenIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a1 1 0 0 1 1-1h4l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1L3 7Zm0 0h17l-1.5 9" />
    </svg>
  );
}

export function FilePlusIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9l-6-6Zm0 0v6h6M12 12v6M9 15h6" />
    </svg>
  );
}

export function ChevronDownIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 9 7 7 7-7" />
    </svg>
  );
}

export function XIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className={className} aria-hidden="true">
      <path strokeLinecap="round" d="M5 5l14 14M19 5 5 19" />
    </svg>
  );
}

export function SearchIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="m20 20-3.8-3.8" />
    </svg>
  );
}

export function InstagramIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TelegramIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M21.9 4.6 18.8 19c-.2 1-.8 1.2-1.7.8l-4.6-3.4-2.2 2.1c-.25.25-.45.45-.95.45l.35-4.9 8.9-8c.4-.35-.1-.55-.6-.2l-11 6.9-4.7-1.5c-1-.3-1-1 .2-1.5l18.5-7.1c.85-.3 1.6.2 1 .99Z" />
    </svg>
  );
}
