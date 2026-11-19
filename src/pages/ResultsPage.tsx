import LayoutPanel from '../components/LayoutPanel';
import ErrorBoundary from '../components/ErrorBoundary';
import AlgorithmComparison from '../components/AlgorithmComparison';
import { fa } from '../i18n/fa';
import type { PageProps } from './props';

/**
 * A-Cut 2Dpro — صفحهٔ «خروجی‌ها»
 * =============================
 * خلاصهٔ نتایج، برگهٔ کنترل تولید، چاپ/PDF، DXF، JSON خروجی و مقایسهٔ
 * الگوریتم‌ها روی همان ورودی.
 */
export default function ResultsPage({ app }: PageProps) {
  const { rows, settings, setSettings, engine, packing, setSelection } = app;

  return (
    <div className="space-y-4">
      <header className="space-y-1 px-1">
        <span className="badge">{fa.nav.results}</span>
        <h2 className="section-title">{fa.results.title}</h2>
        <p className="text-sm font-semibold leading-7 text-muted">{fa.results.subtitle}</p>
      </header>

      <ErrorBoundary label="نتایج و خروجی‌ها">
        <LayoutPanel
          page="results"
          parts={rows}
          settings={settings}
          onSettingsChange={setSettings}
          engine={engine}
        />
      </ErrorBoundary>

      <ErrorBoundary label="مقایسهٔ الگوریتم‌ها">
        <AlgorithmComparison
          parts={rows}
          stock={{ length: settings.stockLength, width: settings.stockWidth }}
          settings={settings}
          selection={packing.selection}
          maxSheets={packing.maxSheets}
          onUse={(selection) => {
            setSelection(selection);
            // بعد از انتخاب، همان الگوریتم محاسبه می‌شود تا نتیجهٔ اصلی هم‌خوان شود
            window.setTimeout(() => engine.calculate(), 0);
          }}
        />
      </ErrorBoundary>
    </div>
  );
}
