/**
 * A-Cut 2Dpro — تعریف صفحه‌های رابط
 * ---------------------------------
 * رابط برنامه دقیقاً چهار صفحهٔ مستقل دارد و هر صفحه فقط کار خودش را
 * انجام می‌دهد. این فایل تنها منبع حقیقتِ فهرست صفحه‌هاست تا هدر، نوار
 * راهنمای پایین، منوی سه‌نقطه و صفحهٔ راهنما همه یک چیز را نشان دهند.
 */

export type AppPage = 'dashboard' | 'drawing' | 'outputs' | 'guide';

export interface PageMeta {
  id: AppPage;
  /** شمارهٔ فارسی صفحه (۱ تا ۴) */
  number: string;
  /** نام کوتاه — روی نوار راهنمای پایین و هدر */
  label: string;
  /** عنوان کامل — تیتر بالای هر صفحه */
  title: string;
  /** توضیح یک‌خطی برای نوار راهنما */
  hint: string;
  /** رنگ اختصاصی همان صفحه (تأکید بصری و شناسایی سریع) */
  color: string;
}

export const PAGES: PageMeta[] = [
  {
    id: 'dashboard',
    number: '۱',
    label: 'داشبورد',
    title: 'داشبورد و تنظیمات',
    hint: 'تم و رنگ، ورق، نوار و ورود قطعات',
    color: '#0ea5e9',
  },
  {
    id: 'drawing',
    number: '۲',
    label: 'نقشه و لیبل',
    title: 'نقشهٔ برش و لیبل‌ها',
    hint: 'نقشهٔ گیلوتینی و برچسب کارگاهی',
    color: '#8b5cf6',
  },
  {
    id: 'outputs',
    number: '۳',
    label: 'خروجی‌ها',
    title: 'خروجی‌ها و چاپ',
    hint: 'PDF، DXF و برگهٔ کنترل تولید',
    color: '#10b981',
  },
  {
    id: 'guide',
    number: '۴',
    label: 'راهنما',
    title: 'راهنمای صفحه‌ها',
    hint: 'آموزش چهار صفحه و قواعد محاسبه',
    color: '#f59e0b',
  },
];

export const TOTAL_PAGES = PAGES.length;

export function getPageMeta(id: AppPage): PageMeta {
  return PAGES.find((page) => page.id === id) ?? PAGES[0];
}

/** صفحهٔ بعدی/قبلی برای دکمه‌های جابه‌جایی داخل هر صفحه */
export function getAdjacentPage(id: AppPage, direction: 1 | -1): PageMeta {
  const index = PAGES.findIndex((page) => page.id === id);
  const next = (index + direction + PAGES.length) % PAGES.length;
  return PAGES[next];
}
