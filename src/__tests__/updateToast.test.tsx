// @vitest-environment jsdom
import { useSyncExternalStore } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * تست جریان بروزرسانی PWA (`UpdateToast`).
 * تمرکز روی باگ‌های واقعی که در این نسخه رفع شدند:
 *  ۱) «بعداً» نباید اعلان را برای همیشه پنهان کند (بازگشت پس از بازهٔ خنک‌شدن)
 *  ۲) نسخهٔ «منتظرِ از قبل موجود» باید در startup دیده شود
 *  ۳) تایمرهای بررسی/خنک‌شدن باید در unmount پاک شوند (بدون نشتی)
 *
 * نکته: ماژول `virtual:pwa-register/react` در `vitest.config.ts` به
 * `src/test/pwaRegisterStub.ts` نگاشت شده است. پس mock کردن همان مسیر
 * واقعی، کامپوننت را به این پیاده‌سازی قلابی وصل می‌کند (mock روی شناسهٔ
 * مجازی کار نمی‌کند چون در زمان transform قابل resolve نیست).
 */

/** وضعیت مشترک قلابی: آیا نسخهٔ جدید در انتظار است؟ */
const store = {
  value: false,
  listeners: new Set<() => void>(),
  set(next: boolean) {
    store.value = next;
    store.listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    store.listeners.add(listener);
    return () => store.listeners.delete(listener);
  },
};

/** آخرین registration قلابی که به کامپوننت داده شده است */
const swState: { waiting: boolean } = { waiting: false };

vi.mock('../test/pwaRegisterStub', () => ({
  useRegisterSW: (options?: {
    onRegisteredSW?: (url: string, registration?: ServiceWorkerRegistration | null) => void;
  }) => {
    const needRefresh = useSyncExternalStore(store.subscribe, () => store.value);
    queueMicrotask(() => {
      const registration = {
        waiting: swState.waiting ? ({} as ServiceWorker) : null,
        update: () => Promise.resolve(),
      } as unknown as ServiceWorkerRegistration;
      options?.onRegisteredSW?.('/sw.js', registration);
    });
    return {
      needRefresh: [needRefresh, (value: boolean) => store.set(value)] as [
        boolean,
        (value: boolean) => void,
      ],
      offlineReady: [false, () => {}] as [boolean, (value: boolean) => void],
      updateServiceWorker: async () => {},
    };
  },
  registerSW: () => async () => {},
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

async function mountToast() {
  const { default: UpdateToast } = await import('../components/UpdateToast');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<UpdateToast />);
  });
  await flush();
}

const toast = () => container.querySelector('[role="alert"]');
const dismissButton = () =>
  Array.from(container.querySelectorAll('button')).find((button) =>
    button.getAttribute('aria-label')?.includes('بعداً'),
  );

beforeEach(() => {
  localStorage.clear();
  store.value = false;
  store.listeners.clear();
  swState.waiting = false;
  vi.useRealTimers();
});

afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('بروزرسانی PWA — اعلان نسخهٔ جدید', () => {
  it('در حالت عادی هیچ اعلانی نشان نمی‌دهد', async () => {
    await mountToast();
    expect(toast()).toBeNull();
  });

  it('وقتی نسخهٔ جدید منتشر شود اعلان ظاهر می‌شود', async () => {
    await mountToast();
    await act(async () => store.set(true));
    await flush();
    expect(toast()).not.toBeNull();
    expect(container.textContent).toContain('نسخهٔ جدید برنامه آماده است');
  });

  it('«بعداً» اعلان را پنهان می‌کند ولی زمان بستن را ذخیره می‌کند', async () => {
    await mountToast();
    await act(async () => store.set(true));
    await flush();
    expect(dismissButton()).toBeTruthy();
    await act(async () => (dismissButton() as HTMLButtonElement).click());
    await flush();
    expect(toast()).toBeNull();
    expect(Number(localStorage.getItem('acut_update_dismissed'))).toBeGreaterThan(0);
  });

  it('پس از پایان بازهٔ خنک‌شدن اعلان برمی‌گردد (باگ «بعداً برای همیشه»)', async () => {
    // زمان بستن را ۳۱ دقیقه عقب می‌بریم ⇒ بازهٔ خنک‌شدن تمام شده است
    localStorage.setItem('acut_update_dismissed', String(Date.now() - 31 * 60 * 1000));
    swState.waiting = true; // نسخهٔ جدید کش‌شده در انتظار کاربر است
    await mountToast();
    await flush();
    expect(toast()).not.toBeNull();
  });

  it('نسخهٔ «منتظرِ از قبل موجود» هنگام بازشدن برنامه دیده می‌شود', async () => {
    swState.waiting = true;
    await mountToast();
    await flush();
    expect(toast()).not.toBeNull();
    expect(store.value).toBe(true);
  });

  it('با گذشت بازهٔ خنک‌شدن، اعلان برای همان نسخهٔ منتظر دوباره ظاهر می‌شود', async () => {
    vi.useFakeTimers();
    swState.waiting = true;
    await mountToast();
    expect(toast()).not.toBeNull();

    // کاربر «بعداً» را می‌زند ⇒ اعلان می‌رود
    await act(async () => (dismissButton() as HTMLButtonElement).click());
    expect(toast()).toBeNull();

    // ۳۰ دقیقه بعد، چون نسخهٔ جدید هنوز منتظر تأیید است، اعلان برمی‌گردد
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 60 * 1000 + 1000);
    });
    expect(toast()).not.toBeNull();
  });

  it('unmount همهٔ تایمرها را پاک می‌کند (بدون نشتی)', async () => {
    vi.useFakeTimers();
    await mountToast();
    act(() => root.unmount());
    root = undefined as unknown as Root;
    expect(vi.getTimerCount()).toBe(0);
  });
});
