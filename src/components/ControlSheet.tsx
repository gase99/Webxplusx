import type { LayoutResult } from '../algorithm';
import { getPlacementCode } from '../exportDxf';
import { calculateMaterialSummary, normalizeEdgeCount, type CutPart } from '../types/part';

interface ControlSheetProps {
  result: LayoutResult;
  parts: CutPart[];
  forPrint?: boolean;
}

const faNumber = new Intl.NumberFormat('fa-IR');
const faDecimal = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });

function describeEdgeCount(value: unknown): string | null {
  const count = normalizeEdgeCount(value);
  if (count === 0) return null;
  return count === 1 ? 'یک لبه' : 'دو لبه';
}

/** تبدیل مقادیر عددی عملیات به شرح قابل‌خواندن برای اپراتور */
function describeOperations(part?: CutPart): string {
  if (!part) return 'اطلاعات عملیات موجود نیست';

  const operations = [
    { name: 'نوار', direction: 'طول', count: describeEdgeCount(part.bandLength) },
    { name: 'نوار', direction: 'عرض', count: describeEdgeCount(part.bandWidth) },
    { name: 'فارسی', direction: 'طول', count: describeEdgeCount(part.farsiLength) },
    { name: 'فارسی', direction: 'عرض', count: describeEdgeCount(part.farsiWidth) },
    { name: 'شیار', direction: 'طول', count: describeEdgeCount(part.grooveLength) },
    { name: 'شیار', direction: 'عرض', count: describeEdgeCount(part.grooveWidth) },
  ];

  const description = operations
    .filter((operation) => operation.count !== null)
    .map((operation) => `${operation.name} ${operation.direction}: ${operation.count}`);

  return description.length > 0 ? description.join('، ') : 'بدون عملیات';
}

/**
 * برگه کنترل تولید — هر ردیف معادل یک قطعهٔ واقعی روی نقشه است.
 * کد نقشه، شرح عملیات و مربع کنترل، تطبیق و بازبینی قطعه را در کارگاه آسان می‌کند.
 */
export default function ControlSheet({ result, parts, forPrint = false }: ControlSheetProps) {
  const partsById = new Map(parts.map((part) => [part.id, part]));
  const counters = new Map<number, number>();
  const entries = result.placements.map((placement) => {
    const indexInSheet = counters.get(placement.sheetIndex) ?? 0;
    counters.set(placement.sheetIndex, indexInSheet + 1);
    return {
      placement,
      indexInSheet,
      source: partsById.get(placement.id),
    };
  });
  const materialSummary = calculateMaterialSummary(parts);

  return (
    <div
      className={`control-sheet mt-6 ${
        forPrint ? '' : 'rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-300/70'
      }`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-slate-300 pb-3">
        <h3 className="text-base font-black text-slate-900">📋 برگه کنترل تولید</h3>
        <span className="text-xs font-medium text-slate-500" dir="ltr">
          Production Control Sheet
        </span>
        <span className="ms-auto rounded-md bg-slate-900 px-2.5 py-1 text-xs font-bold text-white">
          {faNumber.format(result.summary.placedCount)} قطعه · {faNumber.format(result.summary.sheetCount)} ورق · بهره‌وری{' '}
          {faDecimal.format(result.summary.utilizationPercentage)}٪
        </span>
      </div>

      <div className="grid gap-3 text-xs sm:grid-cols-3">
        <div className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
          <div className="font-bold text-slate-600">ابعاد ورق خام</div>
          <div className="mt-1 font-mono text-sm font-black text-slate-900" dir="ltr">
            {result.stock.length} × {result.stock.width} mm
          </div>
          <div className="text-[11px] text-slate-500">
            ضخامت تیغه: {faNumber.format(result.kerf)} mm · چرخش:{' '}
            {result.allowRotation ? 'مجاز' : 'غیرمجاز'}
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
          <div className="font-bold text-slate-600">بهره‌وری کل</div>
          <div className="mt-1 text-lg font-black text-slate-900">
            {faDecimal.format(result.summary.utilizationPercentage)}٪
          </div>
          <div className="text-[11px] text-slate-600">
            پرت: {faDecimal.format(result.summary.wastePercentage)}٪ (شامل Kerf)
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
          <div className="font-bold text-slate-600">تعداد صفحات</div>
          <div className="mt-1 text-lg font-black text-slate-900">
            {faNumber.format(result.summary.sheetCount)}
          </div>
          <div className="text-[11px] text-slate-600">
            {result.unplaced.length > 0
              ? `⚠ ${faNumber.format(result.unplaced.length)} قطعه جا نشد`
              : 'همهٔ قطعات چیده شدند ✓'}
          </div>
        </div>
      </div>

      <h4 className="mt-5 text-sm font-extrabold text-slate-900">
        فهرست کنترل تولید — هر ردیف یک قطعهٔ واقعی
      </h4>
      <div className="control-sheet-scroll mt-2 overflow-auto rounded-lg ring-1 ring-slate-400">
        <table className="control-sheet-table w-full min-w-[1050px] border-collapse text-xs">
          <thead>
            <tr className="bg-slate-900 text-center text-white">
              <th className="border border-slate-700 px-2 py-2">ردیف</th>
              <th className="border border-slate-700 px-2 py-2">کد نقشه</th>
              <th className="border border-slate-700 px-2 py-2">نام قطعه</th>
              <th className="border border-slate-700 px-2 py-2">ابعاد اصلی (mm)</th>
              <th className="border border-slate-700 px-2 py-2">ابعاد روی نقشه (mm)</th>
              <th className="border border-slate-700 px-2 py-2">ورق</th>
              <th className="border border-slate-700 px-2 py-2">مختصات (x,y)</th>
              <th className="border border-slate-700 px-2 py-2">چرخش</th>
              <th className="min-w-[280px] border border-slate-700 px-2 py-2">شرح عملیات</th>
              <th className="border border-slate-700 px-2 py-2">کنترل شد</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={10} className="border border-slate-200 px-3 py-5 text-center text-slate-500">
                  هنوز قطعه‌ای روی ورق چیده نشده است.
                </td>
              </tr>
            ) : (
              entries.map(({ placement, indexInSheet, source }, rowIndex) => {
                const code = getPlacementCode(placement.sheetIndex, indexInSheet);
                return (
                  <tr
                    key={`${placement.id}-${placement.instanceIndex}-${placement.sheetIndex}`}
                    className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                  >
                    <td className="border border-slate-200 px-2 py-2 text-center font-bold">
                      {faNumber.format(rowIndex + 1)}
                    </td>
                    <td className="border border-slate-200 px-2 py-2 text-center font-mono font-bold" dir="ltr">
                      {code}
                    </td>
                    <td className="border border-slate-200 px-2 py-2 text-right font-semibold">
                      {placement.name || source?.name || '—'}
                    </td>
                    <td className="border border-slate-200 px-2 py-2 text-center font-mono tabular-nums" dir="ltr">
                      {source ? `${source.length} × ${source.width}` : '—'}
                    </td>
                    <td className="border border-slate-200 px-2 py-2 text-center font-mono tabular-nums" dir="ltr">
                      {placement.width} × {placement.height}
                    </td>
                    <td className="border border-slate-200 px-2 py-2 text-center">
                      {faNumber.format(placement.sheetIndex + 1)}
                    </td>
                    <td className="border border-slate-200 px-2 py-2 text-center font-mono tabular-nums" dir="ltr">
                      {placement.x}, {placement.y}
                    </td>
                    <td className="border border-slate-200 px-2 py-2 text-center">
                      {placement.isRotated ? '۹۰°' : '—'}
                    </td>
                    <td className="min-w-[280px] border border-slate-200 px-3 py-2 text-right leading-6">
                      {describeOperations(source)}
                    </td>
                    <td className="border border-slate-200 px-2 py-2 text-center align-middle">
                      <span
                        className="control-sheet-check inline-block h-7 w-7 border-2 border-black bg-white align-middle"
                        role="img"
                        aria-label={`مربع کنترل خالی برای ${code}`}
                        title="پس از کنترل قطعه، این مربع را علامت بزنید"
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-600">
        <span className="rounded bg-slate-50 px-2 py-1 ring-1 ring-slate-300">
          یک لبه = یک لبه از دو لبهٔ مقابل · دو لبه = هر دو لبهٔ مقابل
        </span>
        <span className="ms-auto">
          هاشور نقشه، ناحیهٔ باقی‌ماندهٔ ورق (پرت) را نشان می‌دهد.
        </span>
      </div>

      <section className="control-sheet-materials mt-5 rounded-xl border-2 border-slate-900 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-300 pb-3">
          <h4 className="text-base font-black text-slate-900">
            فاکتور متریال مصرفی (تخمینی)
          </h4>
          <span className="ms-auto text-[11px] font-medium text-slate-600">
            محاسبه بر اساس ابعاد، تعداد قطعات و مقادیر لبهٔ ۰/۱/۲
          </span>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <MaterialTotal label="نوار لبه" value={materialSummary.bandMeters} />
          <MaterialTotal label="لبهٔ فارسی ۴۵°" value={materialSummary.farsiMeters} />
          <MaterialTotal label="شیار" value={materialSummary.grooveMeters} />
        </div>
      </section>
    </div>
  );
}

function MaterialTotal({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-center">
      <div className="text-xs font-bold text-slate-600">{label}</div>
      <div className="control-sheet-material-value mt-1 text-2xl font-black tabular-nums text-slate-950 sm:text-3xl" dir="ltr">
        {faDecimal.format(value)} <span className="text-base font-bold">m</span>
      </div>
    </div>
  );
}
