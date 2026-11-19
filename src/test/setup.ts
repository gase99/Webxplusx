/**
 * آماده‌سازی محیط تست (jsdom): اعلام پشتیبانی `act(...)` برای React 19
 * تا هنگام render/click در تست‌ها هشدار داده نشود.
 */
export {};

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
