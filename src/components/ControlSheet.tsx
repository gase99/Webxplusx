import type { LayoutResult, PlacedPart } from '../algorithm';
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

interface ChecklistEntry {
  placement: PlacedPart;
  indexInSheet: number;
  source?: CutPart;
}

/** یک ردیف برای هر قطعهٔ واقعی روی نقشه؛ کد S1-03 هم‌زمان در نقشه/لیبل/DXF */
function buildEntries(result: LayoutResult, parts: CutPart[]): ChecklistEntry[] {
  const partsById = new Map(parts.map((part) => [part.id, part]));
  const counters = new Map<number, number>();
  return result.placements.map((placement) => {
    const indexInSheet = counters.get(placement.sheetIndex) ?? 0;
    counters.set(placement.sheetIndex, indexInSheet + 1);
    return { placement, indexInSheet, source: partsById.get(placement.id) };
  });
}

interface ChecklistGroup {
  key: string;
  name: string;
  dims: string;
  description: string;
  count: number;
  sheets: Set<number>;
  codes: string[];
}

/**
 * گروه‌بندی قطعات چیده‌شده بر اساس نام، ابعاد و شرح عملیات.
 * هر گروه یک ردیف در جدول چاپی می‌شود و همهٔ کدهای نقشهٔ همان گروه را نشان می‌دهد.
 */
function buildGroups(entries: ChecklistEntry[]): ChecklistGroup[] {
  const groups = new Map<string, ChecklistGroup>();
  for (const { placement, indexInSheet, source } of entries) {
    const name = (placement.name || source?.name || 'بدون نام').trim() || 'بدون نام';
    const dims = source
      ? `${source.length} × ${source.width}`
      : `${placement.width} × ${placement.height}`;
    const description = describeOperations(source);
    const code = getPlacementCode(placement.sheetIndex, indexInSheet);
    const key = `${name}|${dims}|${description}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      existing.sheets.add(placement.sheetIndex);
      existing.codes.push(code);
    } else {
      groups.set(key, {
        key,
        name,
        dims,
        description,
        count: 1,
        sheets: new Set([placement.sheetIndex]),
        codes: [code],
      });
    }
  }
  return Array.from(groups.values());
}

/** مربع خالی کنترل کارگاهی — پس از بازبینی هر قطعه/گروه علامت زده می‌شود */
function CheckBox({ code }: { code: string }) {
  return (
    <span
      className="control-sheet-check inline-block h-7 w-7 border-2 border-black bg-white align-middle"
      role="img"
      aria-label={`مربع کنترل خالی برای ${code}`}
      title="پس از کنترل قطعه، این مربع را علامت بزنید"
    />
  );
}

interface PartsChecklistProps {
  result: LayoutResult;
  parts: CutPart[];
  /** true: یک ردیف برای هر نوع قطعه (گروه‌بندی‌شده) — false: هر ردیف یک قطعهٔ واقعی */
  grouped?: boolean;
}

/**
 * جدول مشترک برگهٔ کنترل و سند چاپی نقشه.
 * در حالت `grouped` قطعات هم‌نام و هم‌ابعاد با شرح عملیات یکسان در یک ردیف
 * با ستون «تعداد» و «کدهای نقشه» جمع می‌شوند تا در چاپ زیر نقشه جا شود.
 */
export function PartsChecklist({ result, parts, grouped = false }: PartsChecklistProps) {
  const entries = buildEntries(result, parts);
  const groups = grouped ? buildGroups(entries) : [];

  return (
    <div className="control-sheet-scroll mt-2 overflow-auto rounded-lg ring-1 ring-slate-400">
      <table
        className={`control-sheet-table w-full border-collapse text-xs ${
          grouped ? 'control-sheet-table--grouped min-w-[920px]' : 'min-w-[1050px]'
        }`}
      >
        <thead>
          {grouped ? (
            <tr className="bg-slate-900 text-center text-white">
              <th className="border border-slate-700 px-2 py-2">ردیف</th>
              <th className="border border-slate-700 px-2 py-2">نام قطعه</th>
              <th className="border border-slate-700 px-2 py-2">ابعاد اصلی (mm)</th>
              <th className="border border-slate-700 px-2 py-2">تعداد</th>
              <th className="border border-slate-700 px-2 py-2">ورق‌ها</th>
              <th className="border border-slate-700 px-2 py-2">کدهای نقشه</th>
              <th className="min-w-[260px] border border-slate-700 px-2 py-2">شرح عملیات</th>
              <th className="border border-slate-700 px-2 py-2">کنترل شد</th>
            </tr>
          ) : (
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
          )}
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td
                colSpan={grouped ? 8 : 10}
                className="border border-slate-200 px-3 py-5 text-center text-slate-500"
              >
                هنوز قطعه‌ای روی ورق چیده نشده است.
              </td>
            </tr>
          ) : grouped ? (
            groups.map((group, rowIndex) => (
              <tr
                key={group.key}
                className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
              >
                <td className="border border-slate-200 px-2 py-2 text-center font-bold">
                  {faNumber.format(rowIndex + 1)}
                </td>
                <td className="border border-slate-200 px-2 py-2 text-right font-semibold">
                  {group.name}
                </td>
                <td
                  className="border border-slate-200 px-2 py-2 text-center font-mono tabular-nums"
                  dir="ltr"
                >
                  {group.dims}
                </td>
                <td className="border border-slate-200 px-2 py-2 text-center font-bold tabular-nums">
                  {faNumber.format(group.count)}
                </td>
                <td className="border border-slate-200 px-2 py-2 text-center">
                  {Array.from(group.sheets)
                    .sort((a, b) => a - b)
                    .map((sheetIndex) => faNumber.format(sheetIndex + 1))
                    .join('، ')}
                </td>
                <td
                  className="border border-slate-200 px-2 py-2 text-center font-mono text-[11px] font-bold"
                  dir="ltr"
                >
                  {group.codes.join('، ')}
                </td>
                <td className="border border-slate-200 px-3 py-2 text-right leading-6">
                  {group.description}
                </td>
                <td className="border border-slate-200 px-2 py-2 text-center align-middle">
                  <CheckBox code={`${group.name} (${group.dims} mm)`} />
                </td>
              </tr>
            ))
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
                  <td
                    className="border border-slate-200 px-2 py-2 text-center font-mono font-bold"
                    dir="ltr"
                  >
                    {code}
                  </td>
                  <td className="border border-slate-200 px-2 py-2 text-right font-semibold">
                    {placement.name || source?.name || '—'}
                  </td>
                  <td
                    className="border border-slate-200 px-2 py-2 text-center font-mono tabular-nums"
                    dir="ltr"
                  >
                    {source ? `${source.length} × ${source.width}` : '—'}
                  </td>
                  <td
                    className="border border-slate-200 px-2 py-2 text-center font-mono tabular-nums"
                    dir="ltr"
                  >
                    {placement.width} × {placement.height}
                  </td>
                  <td className="border border-slate-200 px-2 py-2 text-center">
                    {faNumber.format(placement.sheetIndex + 1)}
                  </td>
                  <td
                    className="border border-slate-200 px-2 py-2 text-center font-mono tabular-nums"
                    dir="ltr"
                  >
                    {placement.x}, {placement.y}
                  </td>
                  <td className="border border-slate-200 px-2 py-2 text-center">
                    {placement.isRotated ? '۹۰°' : '—'}
                  </td>
                  <td className="min-w-[280px] border border-slate-200 px-3 py-2 text-right leading-6">
                    {describeOperations(source)}
                  </td>
                  <td className="border border-slate-200 px-2 py-2 text-center align-middle">
                    <CheckBox code={code} />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

/** فاکتور تخمینی متریال مصرفی — مشترک بین برگهٔ کنترل و سند چاپی نقشه */
export function MaterialSummaryCard({ parts }: { parts: CutPart[] }) {
  const materialSummary = calculateMaterialSummary(parts);
  return (
    <section className="control-sheet-materials mt-5 rounded-xl border-2 border-slate-900 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-300 pb-3">
        <h4 className="text-base font-black text-slate-900">فاکتور متریال مصرفی (تخمینی)</h4>
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
  );
}

/** سند چاپی زیر نقشه: فهرست گروه‌بندی‌شدهٔ قطعات + فاکتور متریال */
export function PrintPartsList({ result, parts }: { result: LayoutResult; parts: CutPart[] }) {
  const groupCount = buildGroups(buildEntries(result, parts)).length;
  return (
    <section className="print-parts-section mt-6">
      <div className="mb-2 flex flex-wrap items-end gap-x-3 gap-y-1 border-b-2 border-slate-800 pb-2">
        <h2 className="text-base font-black text-slate-900">
          📋 فهرست کنترل تولید — گروه‌بندی‌شده
        </h2>
        <span className="text-xs font-medium text-slate-500" dir="ltr">
          Production Checklist
        </span>
        <span className="ms-auto rounded-md bg-slate-900 px-2.5 py-1 text-xs font-bold text-white">
          {faNumber.format(result.summary.placedCount)} قطعه ·{' '}
          {faNumber.format(groupCount)} گروه · {faNumber.format(result.summary.sheetCount)} ورق
        </span>
      </div>
      <p className="text-[11px] leading-5 text-slate-600">
        هر ردیف یک نوع قطعه است؛ تعداد، ورق و کدهای نقشهٔ همان نوع را نشان می‌دهد. پس از
        کنترل هر گروه، مربع ستون «کنترل شد» را علامت بزنید.
      </p>
      <PartsChecklist result={result} parts={parts} grouped />
      <MaterialSummaryCard parts={parts} />
    </section>
  );
}

/**
 * برگه کنترل تولید — هر ردیف معادل یک قطعهٔ واقعی روی نقشه است.
 * کد نقشه، شرح عملیات و مربع کنترل، تطبیق و بازبینی قطعه را در کارگاه آسان می‌کند.
 * در نسخهٔ چاپی نقشه، از جدول گروه‌بندی‌شدهٔ `PrintPartsList` استفاده می‌شود.
 */
export default function ControlSheet({ result, parts, forPrint = false }: ControlSheetProps) {
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
      <PartsChecklist result={result} parts={parts} />

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-600">
        <span className="rounded bg-slate-50 px-2 py-1 ring-1 ring-slate-300">
          یک لبه = یک لبه از دو لبهٔ مقابل · دو لبه = هر دو لبهٔ مقابل
        </span>
        <span className="ms-auto">
          هاشور نقشه، ناحیهٔ باقی‌ماندهٔ ورق (پرت) را نشان می‌دهد.
        </span>
      </div>

      <MaterialSummaryCard parts={parts} />
    </div>
  );
}

function MaterialTotal({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-center">
      <div className="text-xs font-bold text-slate-600">{label}</div>
      <div
        className="control-sheet-material-value mt-1 text-2xl font-black tabular-nums text-slate-950 sm:text-3xl"
        dir="ltr"
      >
        {faDecimal.format(value)} <span className="text-base font-bold">m</span>
      </div>
    </div>
  );
}
