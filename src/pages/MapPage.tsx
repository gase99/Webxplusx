import LayoutPanel from '../components/LayoutPanel';
import ErrorBoundary from '../components/ErrorBoundary';
import { fa } from '../i18n/fa';
import type { PageProps } from './props';

/**
 * A-Cut 2Dpro — صفحهٔ «نقشه»
 * =========================
 * نقشهٔ برش هر ورق، لیبل‌های کارگاهی و علائم لبه. نتیجه همان نتیجهٔ محاسبهٔ
 * مشترک است، پس جابه‌جایی بین این صفحه و «خروجی‌ها» چیزی را از بین نمی‌برد.
 */
export default function MapPage({ app }: PageProps) {
  const { rows, settings, setSettings, engine } = app;

  return (
    <div className="space-y-4">
      <header className="space-y-1 px-1">
        <span className="badge">{fa.nav.map}</span>
        <h2 className="section-title">{fa.map.title}</h2>
        <p className="text-sm font-semibold leading-7 text-muted">{fa.map.subtitle}</p>
      </header>

      <ErrorBoundary label="نقشهٔ برش">
        <LayoutPanel page="map" parts={rows} settings={settings} onSettingsChange={setSettings} engine={engine} />
      </ErrorBoundary>
    </div>
  );
}
