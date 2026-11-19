/**
 * A-Cut 2Dpro — موتور بهینه‌سازی برش (نسخهٔ چندالگوریتمی)
 * ======================================================
 * این فایل فقط «پوستهٔ سازگاری» است: پیاده‌سازی‌ها به `src/engine/` منتقل
 * شده‌اند تا افزودن الگوریتم جدید ساده باشد.
 *
 *  - `src/engine/types.ts`      : رابط مشترک `PackingAlgorithm` و تایپ‌ها
 *  - `src/engine/shared.ts`     : اعتبارسنجی ورودی، ساخت نتیجه، متریک‌ها
 *  - `src/engine/guillotine.ts` : گیلوتینی (پیش‌فرض و سازگار با نسخهٔ قبل)
 *  - `src/engine/maxrects.ts`   : MaxRects با چهار هیوریستیک
 *  - `src/engine/skyline.ts`    : Skyline (Bottom-Left / Min-Waste)
 *  - `src/engine/shelf.ts`      : Shelf / NFDH
 *  - `src/engine/optimizer.ts`  : بهینه‌ساز Simulated Annealing
 *  - `src/engine/registry.ts`   : فهرست مرکزی الگوریتم‌ها
 *
 * همهٔ importهای قدیمی (`from './algorithm'`) بدون تغییر کار می‌کنند.
 */
export * from './engine';
