/** پالت رنگ ویدیو — هماهنگ با هویت برنامه (آبی آسمانی + سبز دکمهٔ محاسبه) */
export const COLORS = {
  bgDeep: '#020617',
  bg: '#0f172a',
  bgSoft: '#1e293b',
  sky: '#0284c7',
  skyLight: '#38bdf8',
  skySoft: '#7dd3fc',
  emerald: '#059669',
  emeraldLight: '#34d399',
  white: '#f8fafc',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  paper: '#ffffff',
  ink: '#0f172a',
};

/** ارقام لاتین را فارسی می‌کند */
export const faNum = (n: number, maximumFractionDigits = 0): string =>
  n.toLocaleString('fa-IR', { maximumFractionDigits });
