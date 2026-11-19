/**
 * Stub ماژول مجازی PWA برای محیط تست
 * ==================================
 * در بیلد واقعی، `vite-plugin-pwa` این ماژول را می‌سازد. در Vitest همان
 * قرارداد `useRegisterSW` را برمی‌گردانیم تا کامپوننت `UpdateToast` بدون
 * سرویس‌ورکر تست شود (همان رفتار بیلد بومی `--mode app`).
 */

type Setter<T> = (value: T | ((previous: T) => T)) => void;

export interface RegisterSWOptions {
  onRegisteredSW?: (swUrl: string, registration?: ServiceWorkerRegistration | null) => void;
  onRegisterError?: (error: Error) => void;
  onOfflineReady?: () => void;
  onNeedRefresh?: () => void;
}

export function useRegisterSW(_options?: RegisterSWOptions) {
  return {
    needRefresh: [false, () => undefined] as [boolean, Setter<boolean>],
    offlineReady: [false, () => undefined] as [boolean, Setter<boolean>],
    updateServiceWorker: async (_reloadPage?: boolean) => undefined,
  };
}

export function registerSW(_options?: RegisterSWOptions) {
  return async (_reloadPage?: boolean) => undefined;
}
