/**
 * A-Cut 2Dpro — Web Worker موتور چیدمان
 * =====================================
 * حالت «بهینه‌ساز» روی موبایل/WebView می‌تواند چند صد میلی‌ثانیه طول بکشد و
 * اگر روی ترد اصلی اجرا شود رابط کاربری قفل می‌شود. این Worker همان موتور را
 * در یک ترد جدا اجرا می‌کند:
 *   UI ──request──▶ Worker ──result/progress──▶ UI
 *
 * پیام‌ها:
 *  - `run`     : { id, input }  ⇒ اجرای چیدمان
 *  - `cancel`  : { id }         ⇒ لغو اجرای در جریان
 * پاسخ‌ها:
 *  - `progress`: { id, ratio, message }
 *  - `done`    : { id, result, issues }
 *  - `error`   : { id, message }
 */
import { runLayout, type RunLayoutInput } from '../algorithm';
import type { LayoutResult, PackingProgress } from '../engine/types';
import type { ValidationIssue } from '../engine/shared';

export interface WorkerRunRequest {
  type: 'run';
  id: number;
  input: Omit<RunLayoutInput, 'options'> & {
    options?: Omit<NonNullable<RunLayoutInput['options']>, 'onProgress' | 'signal'>;
  };
}

export interface WorkerCancelRequest {
  type: 'cancel';
  id: number;
}

export type WorkerRequest = WorkerRunRequest | WorkerCancelRequest;

export type WorkerResponse =
  | { type: 'progress'; id: number; progress: PackingProgress }
  | { type: 'done'; id: number; result: LayoutResult; issues: ValidationIssue[] }
  | { type: 'error'; id: number; message: string };

/** سیگنال‌های لغو بر اساس شناسهٔ درخواست */
const signals = new Map<number, { aborted: boolean }>();

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;

  if (message.type === 'cancel') {
    const signal = signals.get(message.id);
    if (signal) signal.aborted = true;
    return;
  }

  if (message.type !== 'run') return;

  const signal = { aborted: false };
  signals.set(message.id, signal);

  try {
    const { result, report } = runLayout({
      parts: message.input.parts,
      stock: message.input.stock,
      selection: message.input.selection,
      options: {
        ...message.input.options,
        signal,
        onProgress: (progress) => {
          const response: WorkerResponse = { type: 'progress', id: message.id, progress };
          self.postMessage(response);
        },
      },
    });
    const response: WorkerResponse = {
      type: 'done',
      id: message.id,
      result,
      issues: report.issues,
    };
    self.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = {
      type: 'error',
      id: message.id,
      message: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(response);
  } finally {
    signals.delete(message.id);
  }
};
