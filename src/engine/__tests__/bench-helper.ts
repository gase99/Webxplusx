/**
 * اندازه‌گیری زمان در محیط تست (performance.now در Node موجود است).
 */
export function bench<T>(fn: () => T): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}
