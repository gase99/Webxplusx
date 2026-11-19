/**
 * A-Cut 2Dpro — حالت بهینه‌سازی (Simulated Annealing)
 * ===================================================
 * الگوریتم‌های چیدمان حریصانه به «ترتیب» و «جهت» قطعات حساس‌اند. این حالت
 * با جابه‌جایی و چرخش تصادفیِ ترتیب قطعات، چند چیدمان را امتحان می‌کند و
 * بهترین را برمی‌گرداند.
 *
 * ویژگی‌ها:
 *  - **بازتولیدپذیر**: مولد تصادفیِ بذردار (mulberry32) — با بذر و تعداد
 *    تکرار یکسان، خروجی همیشه یکسان است.
 *  - **قابل لغو**: با `signal.aborted = true` حلقه در اولین فرصت متوقف
 *    می‌شود و بهترین نتیجهٔ تا این لحظه برگردانده می‌شود.
 *  - **گزارش پیشرفت**: `onProgress` برای نمایش درصد در رابط کاربری.
 *  - تابع هدف: کمینه‌سازی (تعداد ورق، سپس پرت، سپس مجموع ارتفاع).
 *  - الگوریتم درونی قابل انتخاب: MaxRects (پیش‌فرض) یا گیلوتینی.
 */
import { DEFAULT_OPTIMIZER_ITERATIONS, DEFAULT_OPTIMIZER_SEED, MAX_OPTIMIZER_ITERATIONS } from '../config/constants';
import { round2 } from './shared';
import { runGuillotine } from './guillotine';
import { resolveMaxRectsHeuristic, runMaxRects } from './maxrects';
import type {
  AlgorithmVariant,
  PackingAlgorithm,
  PackingContext,
  PackingOutcome,
  PartInstance,
} from './types';

/** مولد تصادفی سریع و بذردار (mulberry32) */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** جابه‌جایی دو عنصر آرایه (کپی) */
function swap<T>(list: readonly T[], i: number, j: number): T[] {
  const next = [...list];
  const tmp = next[i];
  next[i] = next[j];
  next[j] = tmp;
  return next;
}

/** امتیاز یک نتیجه — کوچک‌تر بهتر: (ورق، پرت، ارتفاع کل) */
export function scoreOutcome(outcome: PackingOutcome): number {
  const unplacedPenalty = outcome.unplaced.length * 1_000_000;
  const waste = outcome.sheets.reduce((sum, sheet) => sum + sheet.wasteArea, 0);
  const height = outcome.placements.reduce((sum, p) => sum + p.y + p.height, 0);
  return outcome.sheets.length * 1_000_000_000 + unplacedPenalty + waste * 10 + height;
}

export function resolveOptimizerInner(
  variant: AlgorithmVariant | undefined,
): { id: 'maxrects' | 'guillotine'; variant: AlgorithmVariant } {
  if (variant === 'sa-guillotine') {
    return { id: 'guillotine', variant: 'best-area-fit' };
  }
  const heuristic = resolveMaxRectsHeuristic(variant);
  const mapped: AlgorithmVariant =
    heuristic === 'best-short-side-fit' ? 'best-short-side-fit' : heuristic;
  return { id: 'maxrects', variant: mapped };
}

/**
 * اجرای بهینه‌سازی.
 * ترتیب اولیه = همان ترتیب «بزرگ‌تر اول» الگوریتم‌های دیگر تا حالت شروع
 * هیچ‌وقت بدتر از آن‌ها نباشد (بهترین نتیجه در طول جستجو نگه داشته می‌شود).
 */
export function runOptimizer(context: PackingContext): PackingOutcome {
  const inner = resolveOptimizerInner(context.selection.variant);
  const iterations = Math.min(
    MAX_OPTIMIZER_ITERATIONS,
    Math.max(1, Math.floor(context.selection.iterations ?? DEFAULT_OPTIMIZER_ITERATIONS)),
  );
  const seed = Math.floor(context.selection.seed ?? DEFAULT_OPTIMIZER_SEED);
  const random = createRandom(seed);

  const instances = [...context.instances].sort(
    (a, b) => b.area - a.area || b.maxDimension - a.maxDimension || a.originalOrder - b.originalOrder,
  );

  const evaluate = (order: PartInstance[]): PackingOutcome => {
    const ordered = order.map((instance, index) => ({ ...instance, originalOrder: index }));
    const innerContext: PackingContext = {
      ...context,
      instances: ordered,
      selection: { ...context.selection, id: inner.id, variant: inner.variant },
    };
    return inner.id === 'guillotine' ? runGuillotine(innerContext) : runMaxRects(innerContext);
  };

  let current = instances;
  let currentOutcome = evaluate(current);
  let currentScore = scoreOutcome(currentOutcome);
  let bestOutcome = currentOutcome;
  let bestScore = currentScore;

  // دمای آغازین نسبت به مقیاس مساحت ورق تا رفتار SA مستقل از ابعاد باشد
  const stockArea = context.stock.length * context.stock.width;
  const startTemp = Math.max(1, stockArea * 0.02);
  const endTemp = Math.max(0.5, stockArea * 0.0005);

  for (let iteration = 0; iteration < iterations; iteration++) {
    if (context.signal?.aborted) break;

    // ۵٪ زمان فقط پیشرفت را گزارش می‌کنیم (جلوگیری از رندرهای بی‌مورد)
    if (context.onProgress && iteration % Math.max(1, Math.floor(iterations / 20)) === 0) {
      context.onProgress({
        ratio: iteration / iterations,
        message: `بهینه‌سازی چیدمان — تکرار ${iteration.toLocaleString('fa-IR')} از ${iterations.toLocaleString('fa-IR')}`,
      });
    }

    // کوچک محلی: جابه‌جایی دو عنصر یا برگرداندن یک بازه
    const candidateOrder =
      random() < 0.5
        ? swap(current, Math.floor(random() * current.length), Math.floor(random() * current.length))
        : (() => {
            const from = Math.floor(random() * current.length);
            const to = Math.min(current.length, from + 1 + Math.floor(random() * 4));
            return [...current.slice(0, from), ...current.slice(from, to).reverse(), ...current.slice(to)];
          })();

    const candidateOutcome = evaluate(candidateOrder);
    const candidateScore = scoreOutcome(candidateOutcome);

    const progress = iteration / iterations;
    const temperature = startTemp * Math.pow(endTemp / startTemp, progress);
    const delta = candidateScore - currentScore;
    const accept = delta <= 0 || random() < Math.exp(-delta / temperature);

    if (accept) {
      current = candidateOrder;
      currentOutcome = candidateOutcome;
      currentScore = candidateScore;
      if (candidateScore < bestScore) {
        bestScore = candidateScore;
        bestOutcome = candidateOutcome;
      }
    }
  }

  if (context.onProgress) {
    context.onProgress({ ratio: 1, message: 'بهینه‌سازی تمام شد' });
  }

  // مختصات را برای نمایش یکدست گرد می‌کنیم
  return {
    sheets: bestOutcome.sheets.map((sheet) => ({
      ...sheet,
      placements: sheet.placements.map((p) => ({ ...p, x: round2(p.x), y: round2(p.y) })),
    })),
    placements: bestOutcome.placements,
    unplaced: bestOutcome.unplaced,
  };
}

export const optimizerAlgorithm: PackingAlgorithm = {
  id: 'optimizer',
  label: 'بهینه‌ساز (Annealing)',
  description:
    'جستجوی هوشمند روی ترتیب و جهت قطعات برای کمترین تعداد ورق؛ کندتر است ولی نتایج بهتری می‌دهد. قابل لغو و بازتولید با بذر.',
  variants: [
    { value: 'sa-maxrects', label: 'بهینه‌سازی با MaxRects (پیش‌فرض)' },
    { value: 'sa-guillotine', label: 'بهینه‌سازی با گیلوتینی' },
  ],
  slow: true,
  run: runOptimizer,
};
