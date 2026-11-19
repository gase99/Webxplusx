/**
 * A-Cut 2Dpro — پل ارتباطی با Web Worker چیدمان
 * ============================================
 * استفاده:
 * ```ts
 * const runner = createPackingRunner();
 * const result = await runner.run({ parts, stock, options, selection }, { onProgress });
 * runner.dispose();
 * ```
 *
 * اگر مرورگر/WebView از Worker پشتیبانی نکند یا ساخت آن شکست بخورد، همان
 * کار روی ترد اصلی انجام می‌شود (fallback) تا عملکرد برنامه هرگز از دست نرود.
 */
import { runLayout, type RunLayoutInput } from '../algorithm';
import { logger } from '../lib/logger';
import type { LayoutResult, PackingProgress } from '../engine/types';
import type { ValidationIssue } from '../engine/shared';
import type { WorkerRequest, WorkerResponse } from './packing.worker';

export interface RunOptions {
  onProgress?: (progress: PackingProgress) => void;
  signal?: { aborted: boolean };
}

export interface RunOutcome {
  result: LayoutResult;
  issues: ValidationIssue[];
  /** آیا در Worker اجرا شد؟ (برای پیام‌های تشخیصی) */
  usedWorker: boolean;
}

export interface PackingRunner {
  run(input: RunLayoutInput, options?: RunOptions): Promise<RunOutcome>;
  cancel(): void;
  dispose(): void;
}

let nextId = 1;

function canUseWorker(): boolean {
  return typeof Worker !== 'undefined';
}

/** آیا الگوریتم انتخابی کند است (بهتر است در Worker اجرا شود)؟ */
export function shouldUseWorker(input: RunLayoutInput): boolean {
  return input.selection?.id === 'optimizer';
}

export function createPackingRunner(): PackingRunner {
  let worker: Worker | null = null;
  let workerFailed = false;
  let activeId: number | null = null;
  let activeReject: ((error: Error) => void) | null = null;

  const ensureWorker = (): Worker | null => {
    if (workerFailed || !canUseWorker()) return null;
    if (worker) return worker;
    try {
      worker = new Worker(new URL('./packing.worker.ts', import.meta.url), { type: 'module' });
      worker.onerror = (event) => {
        logger.warn('Web Worker چیدمان خطا داد؛ محاسبه روی ترد اصلی انجام می‌شود', event.message);
        workerFailed = true;
        worker?.terminate();
        worker = null;
        activeReject?.(new Error(event.message || 'worker error'));
      };
      return worker;
    } catch (error) {
      logger.warn('ساخت Web Worker ناموفق بود؛ محاسبه روی ترد اصلی انجام می‌شود', error);
      workerFailed = true;
      return null;
    }
  };

  return {
    async run(input, options: RunOptions = {}): Promise<RunOutcome> {
      const fallback = (): RunOutcome => {
        const { result, report } = runLayout({
          ...input,
          options: {
            ...input.options,
            onProgress: options.onProgress,
            signal: options.signal,
          },
        });
        return { result, issues: report.issues, usedWorker: false };
      };

      const instance = shouldUseWorker(input) ? ensureWorker() : null;
      if (!instance) return fallback();

      const id = nextId++;
      activeId = id;

      return new Promise<RunOutcome>((resolve, reject) => {
        const cleanup = () => {
          instance.removeEventListener('message', onMessage as EventListener);
          activeId = null;
          activeReject = null;
        };

        const finishFallback = () => {
          cleanup();
          try {
            resolve(fallback());
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        };

        const onMessage = (event: MessageEvent<WorkerResponse>) => {
          const data = event.data;
          if (!data || data.id !== id) return;
          if (data.type === 'progress') {
            options.onProgress?.(data.progress);
            return;
          }
          if (data.type === 'done') {
            cleanup();
            resolve({ result: data.result, issues: data.issues, usedWorker: true });
            return;
          }
          if (data.type === 'error') {
            logger.error('اجرای چیدمان در Worker ناموفق بود', data.message);
            // یک‌بار روی ترد اصلی امتحان می‌کنیم تا کاربر نتیجه بگیرد
            workerFailed = true;
            instance.terminate();
            worker = null;
            finishFallback();
          }
        };

        activeReject = () => {
          if (activeId === id) finishFallback();
        };
        instance.addEventListener('message', onMessage as EventListener);
        instance.postMessage({
          type: 'run',
          id,
          input: {
            parts: input.parts,
            stock: input.stock,
            selection: input.selection,
            options: {
              kerf: input.options?.kerf,
              bandThickness: input.options?.bandThickness,
              allowRotation: input.options?.allowRotation,
              sheetColor: input.options?.sheetColor,
              bandColor: input.options?.bandColor,
              maxSheets: input.options?.maxSheets,
              algorithm: input.options?.algorithm,
            },
          },
        } satisfies WorkerRequest);
      });
    },

    cancel(): void {
      if (activeId === null) return;
      const message: WorkerRequest = { type: 'cancel', id: activeId };
      worker?.postMessage(message);
      activeId = null;
    },

    dispose(): void {
      worker?.terminate();
      worker = null;
    },
  };
}
