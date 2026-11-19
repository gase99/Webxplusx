/**
 * A-Cut 2Dpro — قلاب مشترک محاسبهٔ چیدمان
 * ======================================
 * منطق «محاسبه» فقط یک‌جا (همین‌جا) زندگی می‌کند تا هر چهار صفحهٔ برنامه
 * همان نتیجه، همان وضعیت «قدیمی/به‌روز» و همان انتخاب الگوریتم را ببینند.
 *
 * ویژگی‌ها:
 *  - اجرای بهینه‌ساز در Web Worker (رابط کاربری قفل نمی‌شود) + گزارش پیشرفت
 *  - امکان لغو محاسبهٔ در جریان
 *  - اعتبارسنجی ورودی قبل از اجرا و برگرداندن پیام فارسی
 *  - حفظ نتیجه در App (نه در کامپوننت) تا با تغییر تب از بین نرود
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  runLayout,
  validateLayoutInput,
  type AlgorithmSelection,
  type LayoutResult,
  type StockSheet,
} from '../algorithm';
import { logger } from '../lib/logger';
import { createPackingRunner, type PackingRunner } from '../workers/packingClient';
import type { CutPart } from '../types/part';
import type { LayoutSettings, LayoutState } from '../types/project';
import type { PackingProgress } from '../engine/types';

export interface CalculateArgs {
  parts: CutPart[];
  settings: LayoutSettings;
  selection: AlgorithmSelection;
  maxSheets: number;
  signature: string;
}

export interface UseLayoutEngineOptions {
  layoutState: LayoutState | null;
  onLayoutStateChange: (state: LayoutState | null) => void;
}

export interface UseLayoutEngineResult {
  result: LayoutResult | null;
  /** قطعات اسنپ‌شات‌شدهٔ همان محاسبه (فلگ‌های نقشه از این‌ها می‌آید) */
  resultParts: CutPart[];
  /** امضای نتیجهٔ فعلی */
  resultSignature: string | null;
  error: string | null;
  setError: (message: string | null) => void;
  /** پیام‌های غیرمسدودکننده (مثلاً تعداد کسری) */
  warnings: string[];
  busy: boolean;
  progress: PackingProgress | null;
  calculate: (args: CalculateArgs) => Promise<boolean>;
  cancel: () => void;
}

export function useLayoutEngine({
  layoutState,
  onLayoutStateChange,
}: UseLayoutEngineOptions): UseLayoutEngineResult {
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<PackingProgress | null>(null);
  const runnerRef = useRef<PackingRunner | null>(null);
  const cancelledRef = useRef(false);
  /**
   * شناسهٔ اجرای جاری: با هر «لغو» یا شروع محاسبهٔ تازه بالا می‌رود تا نتیجهٔ
   * اجرای قدیمی (که دیر رسیده) هرگز وضعیت جدید را بازنویسی نکند.
   */
  const runIdRef = useRef(0);

  // یک نمونهٔ Runner برای کل عمر صفحه (Worker یک‌بار ساخته می‌شود)
  useEffect(() => {
    const runner = createPackingRunner();
    runnerRef.current = runner;
    return () => {
      runner.cancel();
      runner.dispose();
      runnerRef.current = null;
    };
  }, []);

  const calculate = useCallback(
    async ({ parts, settings, selection, maxSheets, signature }: CalculateArgs): Promise<boolean> => {
      const stock: StockSheet = { length: settings.stockLength, width: settings.stockWidth };
      cancelledRef.current = false;
      const runId = ++runIdRef.current;

      // ۱) اعتبارسنجی ورودی — هیچ عدد نامعتبری به موتور نمی‌رسد
      const report = validateLayoutInput({
        parts,
        stock,
        options: {
          kerf: settings.kerf,
          bandThickness: settings.bandThickness,
          allowRotation: settings.allowRotation,
          maxSheets,
        },
      });
      const warningMessages = report.issues
        .filter((issue) => issue.code === 'FRACTIONAL_QTY' || issue.code === 'EMPTY_PART_DIMENSIONS')
        .map((issue) => issue.message);
      setWarnings(warningMessages);

      if (!report.ok) {
        const blocking = report.issues.find(
          (issue) => issue.code !== 'FRACTIONAL_QTY' && issue.code !== 'EMPTY_PART_DIMENSIONS',
        );
        setError(blocking?.message ?? 'ورودی‌ها معتبر نیستند.');
        return false;
      }
      if (!parts.some((part) => part.length > 0 && part.width > 0 && part.qty > 0)) {
        setError('هنوز هیچ ردیف کاملی (طول، عرض و تعداد) در جدول وارد نشده است.');
        return false;
      }

      setError(null);
      setBusy(true);
      setProgress(null);

      // اگر کاربر محاسبه را لغو کرد، نتیجهٔ نیمه‌کاره نباید جای نتیجهٔ قبلی را بگیرد
      let wasCancelled = false;

      try {
        const runner = runnerRef.current;
        const input = {
          parts,
          stock,
          selection,
          options: {
            kerf: settings.kerf,
            bandThickness: settings.bandThickness,
            allowRotation: settings.allowRotation,
            sheetColor: settings.sheetColor,
            bandColor: settings.bandColor,
            maxSheets,
          },
        };

        const outcome = runner
          ? await runner.run(input, {
              onProgress: (p) => {
                if (!cancelledRef.current) setProgress(p);
              },
            })
          : (() => {
              const { result, report: innerReport } = runLayout(input);
              return { result, issues: innerReport.issues, usedWorker: false };
            })();

        if (cancelledRef.current || runIdRef.current !== runId) {
          // لغو شده یا اجرای تازه‌تری شروع شده است ⇒ این نتیجه دور ریخته می‌شود
          wasCancelled = true;
          return false;
        }

        onLayoutStateChange({
          result: outcome.result,
          // فلگ‌های نقشه از همین اسنپ‌شات خوانده می‌شوند و همراه پروژه ذخیره می‌شود
          partsSnapshot: parts.map((part) => ({ ...part })),
          signature,
        });
        setWarnings(
          outcome.issues
            .filter((issue) => issue.code === 'FRACTIONAL_QTY' || issue.code === 'EMPTY_PART_DIMENSIONS')
            .map((issue) => issue.message),
        );
        return true;
      } catch (caught) {
        if (runIdRef.current !== runId) return false;
        logger.error('محاسبهٔ چیدمان ناموفق بود', caught);
        setError(
          'محاسبهٔ چیدمان با خطا متوقف شد. ورودی‌ها را بررسی کنید و دوباره تلاش کنید؛ اگر تکرار شد، صفحه را یک‌بار بازنشانی کنید.',
        );
        return false;
      } finally {
        // وضعیت «در حال محاسبه» فقط اگر همین اجرا جاری باشد پایین می‌آید
        if (runIdRef.current === runId) {
          setBusy(false);
          setProgress(null);
        }
        if (wasCancelled) cancelledRef.current = false;
      }
    },
    [onLayoutStateChange],
  );

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    runIdRef.current += 1; // نتیجهٔ اجرای در جریان باید دور ریخته شود
    runnerRef.current?.cancel();
    setBusy(false);
    setProgress(null);
    setWarnings([]);
  }, []);

  return {
    result: layoutState?.result ?? null,
    resultParts: layoutState?.partsSnapshot ?? [],
    resultSignature: layoutState?.signature ?? null,
    error,
    setError,
    warnings,
    busy,
    progress,
    calculate,
    cancel,
  };
}
