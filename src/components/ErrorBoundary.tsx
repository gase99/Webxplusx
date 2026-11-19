import { Component, type ErrorInfo, type ReactNode } from 'react';
import { fa } from '../i18n/fa';
import { logger } from '../lib/logger';

/**
 * A-Cut 2Dpro — مرز خطا (Error Boundary)
 * =====================================
 * اگر یک کامپوننت (مثلاً جدول ورود داده یا نقشهٔ برش) هنگام رندر خطا بدهد،
 * کل برنامه نباید سفید شود. این مرز خطا همان بخش را با پیام فارسی و دو
 * دکمه («تلاش دوباره» و «بارگذاری مجدد») جایگزین می‌کند؛ بقیهٔ برنامه سالم
 * می‌ماند و پیش‌نویس خودکار کاربر هم از دست نمی‌رود.
 *
 * استفاده:
 * ```tsx
 * <ErrorBoundary label="نقشهٔ برش"><CuttingMap ... /></ErrorBoundary>
 * ```
 */

interface ErrorBoundaryProps {
  children: ReactNode;
  /** نام فارسی بخش — در پیام خطا نمایش داده می‌شود */
  label?: string;
  /** رندر جایگزین سفارشی (اختیاری) */
  fallback?: (reset: () => void, error: Error) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error(`خطای رندر در بخش «${this.props.label ?? 'برنامه'}»`, {
      message: error.message,
      stack: error.stack?.slice(0, 1200),
      componentStack: info.componentStack?.slice(0, 800),
    });
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  private reload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(this.reset, error);

    return (
      <section
        role="alert"
        aria-live="assertive"
        className="rounded-2xl border-2 border-rose-400/70 bg-rose-500/10 p-5 text-rose-900 dark:text-rose-100"
      >
        <h3 className="text-lg font-black">
          {fa.errors.boundaryTitle}
          {this.props.label ? ` — ${this.props.label}` : ''}
        </h3>
        <p className="mt-1 text-sm font-semibold leading-7">{fa.errors.boundaryHelp}</p>
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer font-bold">جزئیات فنی</summary>
          <pre dir="ltr" className="mt-1 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px]">
            {error.name}: {error.message}
          </pre>
        </details>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={this.reset} className="btn btn-primary">
            {fa.errors.retry}
          </button>
          <button type="button" onClick={this.reload} className="btn btn-secondary">
            {fa.errors.reload}
          </button>
        </div>
      </section>
    );
  }
}
