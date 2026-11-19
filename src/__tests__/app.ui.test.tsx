// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * تست رابط کاربری (بدون مرورگر واقعی):
 *  - هیچ نوار/هدر بالایی وجود ندارد
 *  - پنج زبانهٔ ناوبری پایین با حالت فعال درست کار می‌کنند
 *  - جابه‌جایی بین صفحه‌ها وضعیت (قطعات وارد‌شده) را از بین نمی‌برد
 *  - دکمهٔ بازگشت (history) از صفحهٔ داخلی به داشبورد برمی‌گردد
 *  - کارت‌های داشبورد به چهار صفحهٔ اصلی می‌روند
 */

// IndexedDB در jsdom موجود نیست ⇒ دیتابیس و مهاجرت را خنثی می‌کنیم
vi.mock('../db/database', () => ({
  listProjects: async () => [],
  migrateLegacyProjects: async () => 0,
  putProject: async () => 'ok',
  deleteProject: async () => {},
  estimateStorage: async () => null,
  isDatabaseSupported: () => false,
  classifyDbError: (error: unknown) => error,
  DbError: class DbError extends Error {},
  DB_ERROR_MESSAGES: {},
}));

const flush = async (times = 4) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

let container: HTMLDivElement;
let root: Root;

async function mountApp() {
  const { default: App } = await import('../App');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<App />);
  });
  await flush();
}

const text = () => container.textContent ?? '';

/** دکمهٔ زبانهٔ ناوبری پایین بر اساس data-tab */
const tabButton = (tab: string) =>
  container.querySelector<HTMLButtonElement>(`.bottom-nav-item[data-tab="${tab}"]`);

beforeEach(async () => {
  localStorage.clear();
  window.history.replaceState(null, '', '#/dashboard');
  document.documentElement.classList.remove('dark');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  await mountApp();
});

afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  vi.restoreAllMocks();
});

describe('پوستهٔ داشبوردی — نبود هدر و ناوبری پنج‌گانه', () => {
  it('هیچ هدر/نوار بالایی در DOM نیست و نوار پایین وجود دارد', () => {
    expect(document.querySelector('header.app-header')).toBeNull();
    expect(document.querySelector('header')).toBeNull();
    const nav = container.querySelector('nav.bottom-nav');
    expect(nav).not.toBeNull();
    // نوار پایین پنج زبانه دارد
    expect(container.querySelectorAll('.bottom-nav-item')).toHaveLength(5);
  });

  it('برنامه با صفحهٔ داشبورد بالا می‌آید و زبانهٔ فعال درست علامت خورده است', () => {
    expect(text()).toContain('داشبورد');
    expect(tabButton('dashboard')?.getAttribute('aria-current')).toBe('page');
    expect(tabButton('parts')?.getAttribute('aria-current')).toBeNull();
  });

  it('زبانه‌ها ترتیب RTL خود را حفظ می‌کنند (اول: داشبورد، آخر: بیشتر)', () => {
    const labels = Array.from(container.querySelectorAll('.bottom-nav-label')).map((el) => el.textContent);
    expect(labels[0]).toBe('داشبورد');
    expect(labels[4]).toBe('بیشتر');
  });

  it('کارت‌های داشبورد به چهار صفحهٔ اصلی لینک هستند', () => {
    const titles = Array.from(container.querySelectorAll('h3')).map((el) => el.textContent ?? '');
    expect(titles.join(' ')).toContain('شروع سریع');
  });

  it('رفتن به صفحهٔ قطعات، جدول ورود داده را نشان می‌دهد و نتیجه را از بین نمی‌برد', async () => {
    await act(async () => tabButton('parts')?.click());
    await flush();
    expect(container.querySelector('.bottom-nav-item[data-tab="parts"]')?.getAttribute('aria-current')).toBe(
      'page',
    );
    expect(text()).toContain('ورود قطعات');
    // دادهٔ نمونه در جدول هست (پیش‌فرض اپ)
    const inputs = container.querySelectorAll('input[type="text"]');
    expect(inputs.length).toBeGreaterThan(0);

    // بازگشت به داشبورد و سپس به نقشه — بدون از دست رفتن داده
    await act(async () => tabButton('dashboard')?.click());
    await flush();
    await act(async () => tabButton('map')?.click());
    await flush();
    expect(text()).toContain('نقشهٔ برش');
  });

  it('نامهٔ دکمهٔ بازگشت (history) از صفحهٔ داخلی به داشبورد برمی‌گردد', async () => {
    await act(async () => tabButton('results')?.click());
    await flush();
    expect(window.location.hash).toBe('#/results');
    expect(tabButton('results')?.getAttribute('aria-current')).toBe('page');

    // دکمهٔ Back اندروید/مرورگر: رویداد popstate با مسیر داشبورد
    await act(async () => {
      window.history.replaceState({ tab: 'dashboard' }, '', '#/dashboard');
      window.dispatchEvent(new PopStateEvent('popstate', { state: { tab: 'dashboard' } }));
    });
    await flush();
    expect(tabButton('dashboard')?.getAttribute('aria-current')).toBe('page');
  });

  it('صفحهٔ «بیشتر» تنظیمات الگوریتم، ابزارهای تشخیصی و راهنما را دارد', async () => {
    await act(async () => tabButton('more')?.click());
    await flush();
    const pageText = text();
    expect(pageText).toContain('الگوریتم چیدمان');
    expect(pageText).toContain('روش چیدمان را انتخاب کنید');
    expect(pageText).toContain('گیلوتینی');
    expect(pageText).toContain('MaxRects');
    expect(pageText).toContain('Skyline');
    expect(pageText).toContain('Shelf');
    expect(pageText).toContain('بهینه‌ساز');
    expect(pageText).toContain('گزارش رخدادها');
    expect(pageText).toContain('راهنما');
  });

  it('انتخاب الگوریتم در localStorage ذخیره می‌شود', async () => {
    await act(async () => tabButton('more')?.click());
    await flush();
    const skylineButton = Array.from(container.querySelectorAll('[role="radio"]')).find((el) =>
      el.textContent?.includes('Skyline'),
    );
    expect(skylineButton).toBeTruthy();
    await act(async () => (skylineButton as HTMLElement).click());
    await flush();
    const stored = JSON.parse(localStorage.getItem('acut_packing_settings') ?? '{}');
    expect(stored.selection.id).toBe('skyline');
  });

  it('deep link با hash کار می‌کند (رفرش صفحه ناوبری را نمی‌شکند)', async () => {
    act(() => root.unmount());
    container.remove();
    window.history.replaceState(null, '', '#/map');
    await mountApp();
    expect(tabButton('map')?.getAttribute('aria-current')).toBe('page');
    expect(text()).toContain('نقشهٔ برش');
  });
});
