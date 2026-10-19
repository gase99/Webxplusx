import type { LayoutResult } from '../algorithm';
import { getPlacementCode } from '../exportDxf';
import type { CutPart } from '../types/part';

interface ControlSheetProps {
  result: LayoutResult;
  parts: CutPart[];
  forPrint?: boolean;
}

const faNumber = new Intl.NumberFormat('fa-IR');
const faDecimal = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });

function describeEdgeCount(n: number): string {
  if (n === 2) return '۲ لبه';
  if (n === 1) return '۱ لبه';
  return '—';
}

/**
 * برگه کنترل کارگاهی — فهرست کنترلی برای اپراتور
 * شامل خلاصه پروژه، جدول قطعات با ابعاد و عملیات ۰/۱/۲
 * و تطبیق با نقشه برش (کد S1-03)
 */
export default function ControlSheet({ result, parts, forPrint = false }: ControlSheetProps) {
  const partsById = new Map(parts.map((p) => [p.id, p]));
  // شمارش هر قطعه در هر ورق برای کد S1-03
  const counters = new Map<number, number>();
  const entries = result.placements.map((p) => {
    const idx = counters.get(p.sheetIndex) ?? 0;
    counters.set(p.sheetIndex, idx + 1);
    return { placement: p, indexInSheet: idx, source: partsById.get(p.id) };
  });

  // گروه‌بندی بر اساس نام قطعه برای خلاصه
  const grouped = new Map<string, { part: CutPart; total: number }>();
  for (const p of parts.filter((x) => x.length > 0 && x.width > 0)) {
    const key = `${p.name || 'بدون نام'}|${p.length}x${p.width}`;
    const existing = grouped.get(key);
    if (existing) existing.total += p.qty;
    else grouped.set(key, { part: p, total: p.qty });
  }

  return (
    <div className={`mt-6 ${forPrint ? '' : 'rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-300/70'}`}>
      <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-slate-200 pb-3">
        <h3 className="text-base font-black text-slate-800">📋 برگه کنترل کارگاهی</h3>
        <span className="text-xs font-medium text-slate-500" dir="ltr">Control Sheet</span>
        <span className="ms-auto rounded-md bg-slate-900 px-2.5 py-1 text-xs font-bold text-white">
          {faNumber.format(result.summary.placedCount)} قطعه · {faNumber.format(result.summary.sheetCount)} ورق · بهره‌وری {faDecimal.format(result.summary.utilizationPercentage)}٪
        </span>
      </div>

      <div className="grid gap-3 text-xs sm:grid-cols-3">
        <div className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
          <div className="font-bold text-slate-600">ابعاد ورق خام</div>
          <div className="mt-1 font-mono text-sm font-black text-slate-800" dir="ltr">{result.stock.length} × {result.stock.width} mm</div>
          <div className="text-[11px] text-slate-500">ضخامت تیغه: {faNumber.format(result.kerf)} mm · چرخش: {result.allowRotation ? 'مجاز' : 'غیرمجاز'}</div>
        </div>
        <div className="rounded-lg bg-emerald-50 px-3 py-2 ring-1 ring-emerald-200">
          <div className="font-bold text-emerald-800">بهره‌وری کل</div>
          <div className="mt-1 text-lg font-black text-emerald-700">{faDecimal.format(result.summary.utilizationPercentage)}٪</div>
          <div className="text-[11px] text-emerald-700/70">پرت: {faDecimal.format(result.summary.wastePercentage)}٪ (شامل Kerf)</div>
        </div>
        <div className="rounded-lg bg-sky-50 px-3 py-2 ring-1 ring-sky-200">
          <div className="font-bold text-sky-800">تعداد صفحات</div>
          <div className="mt-1 text-lg font-black text-sky-700">{faNumber.format(result.summary.sheetCount)}</div>
          <div className="text-[11px] text-sky-700/70">{result.unplaced.length > 0 ? `⚠ ${faNumber.format(result.unplaced.length)} قطعه جا نشد` : 'همه قطعات چیده شدند ✓'}</div>
        </div>
      </div>

      <h4 className="mt-5 text-sm font-extrabold text-slate-800">فهرست قطعات (ورودی ۰/۱/۲ — ۰ بدون، ۱ یک لبه، ۲ هر دو لبه)</h4>
      <div className="mt-2 overflow-auto rounded-lg ring-1 ring-slate-300">
        <table className="w-full min-w-[700px] border-collapse text-xs">
          <thead>
            <tr className="bg-slate-800 text-center text-white">
              <th className="border border-slate-700 px-2 py-2">ردیف</th>
              <th className="border border-slate-700 px-2 py-2">نام قطعه</th>
              <th className="border border-slate-700 px-2 py-2">ابعاد</th>
              <th className="border border-slate-700 px-2 py-2">تعداد</th>
              <th className="border border-slate-700 bg-teal-700 px-2 py-1">نوار طول</th>
              <th className="border border-slate-700 bg-teal-700 px-2 py-1">نوار عرض</th>
              <th className="border border-slate-700 bg-rose-700 px-2 py-1">فارسی طول</th>
              <th className="border border-slate-700 bg-rose-700 px-2 py-1">فارسی عرض</th>
              <th className="border border-slate-700 bg-amber-600 px-2 py-1">شیار طول</th>
              <th className="border border-slate-700 bg-amber-600 px-2 py-1">شیار عرض</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(grouped.values()).map((g, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="border border-slate-200 px-2 py-1.5 text-center font-bold">{faNumber.format(idx + 1)}</td>
                <td className="border border-slate-200 px-2 py-1.5 font-semibold">{g.part.name || 'بدون نام'}</td>
                <td className="border border-slate-200 px-2 py-1.5 text-center font-mono tabular-nums" dir="ltr">{g.part.length} × {g.part.width}</td>
                <td className="border border-slate-200 px-2 py-1.5 text-center font-bold">{faNumber.format(g.total)}</td>
                <td className="border border-slate-200 px-2 py-1.5 text-center tabular-nums">{describeEdgeCount(Number(g.part.bandLength))}</td>
                <td className="border border-slate-200 px-2 py-1.5 text-center tabular-nums">{describeEdgeCount(Number(g.part.bandWidth))}</td>
                <td className="border border-slate-200 px-2 py-1.5 text-center tabular-nums">{describeEdgeCount(Number(g.part.farsiLength))}</td>
                <td className="border border-slate-200 px-2 py-1.5 text-center tabular-nums">{describeEdgeCount(Number(g.part.farsiWidth))}</td>
                <td className="border border-slate-200 px-2 py-1.5 text-center tabular-nums">{describeEdgeCount(Number(g.part.grooveLength))}</td>
                <td className="border border-slate-200 px-2 py-1.5 text-center tabular-nums">{describeEdgeCount(Number(g.part.grooveWidth))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4 className="mt-5 text-sm font-extrabold text-slate-800">تطبیق قطعات چیده‌شده با کد نقشه</h4>
      <div className="mt-2 overflow-auto rounded-lg ring-1 ring-slate-300">
        <table className="w-full min-w-[860px] border-collapse text-xs">
          <thead>
            <tr className="bg-slate-700 text-center text-white">
              <th className="border border-slate-600 px-2 py-2">کد</th>
              <th className="border border-slate-600 px-2 py-2">نام</th>
              <th className="border border-slate-600 px-2 py-2">ابعاد اصلی</th>
              <th className="border border-slate-600 px-2 py-2">روی نقشه</th>
              <th className="border border-slate-600 px-2 py-2">ورق</th>
              <th className="border border-slate-600 px-2 py-2">مختصات (x,y)</th>
              <th className="border border-slate-600 px-2 py-2">چرخش</th>
              <th className="border border-slate-600 px-2 py-1">نوار</th>
              <th className="border border-slate-600 px-2 py-1">فارسی</th>
              <th className="border border-slate-600 px-2 py-1">شیار</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const code = getPlacementCode(e.placement.sheetIndex, e.indexInSheet);
              const s = e.source;
              return (
                <tr key={`${e.placement.id}-${e.placement.instanceIndex}-${e.placement.sheetIndex}`} className="text-center">
                  <td className="border border-slate-200 px-2 py-1.5 font-mono font-bold" dir="ltr">{code}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right font-medium">{e.placement.name || s?.name || '—'}</td>
                  <td className="border border-slate-200 px-2 py-1.5 font-mono tabular-nums" dir="ltr">{s ? `${s.length}×${s.width}` : `${e.placement.width}×${e.placement.height}`}</td>
                  <td className="border border-slate-200 px-2 py-1.5 font-mono tabular-nums" dir="ltr">{e.placement.width}×{e.placement.height}</td>
                  <td className="border border-slate-200 px-2 py-1.5">{faNumber.format(e.placement.sheetIndex + 1)}</td>
                  <td className="border border-slate-200 px-2 py-1.5 font-mono tabular-nums" dir="ltr">{e.placement.x},{e.placement.y}</td>
                  <td className="border border-slate-200 px-2 py-1.5">{e.placement.isRotated ? '۹۰°' : '—'}</td>
                  <td className="border border-slate-200 px-2 py-1.5">{s ? `${Number(s.bandLength)}/${Number(s.bandWidth)}` : '—'}</td>
                  <td className="border border-slate-200 px-2 py-1.5">{s ? `${Number(s.farsiLength)}/${Number(s.farsiWidth)}` : '—'}</td>
                  <td className="border border-slate-200 px-2 py-1.5">{s ? `${Number(s.grooveLength)}/${Number(s.grooveWidth)}` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
        <span className="rounded bg-teal-50 px-2 py-1 ring-1 ring-teal-200">نوار: ۰ بدون · ۱ یک لبه · ۲ هر دو لبه</span>
        <span className="rounded bg-rose-50 px-2 py-1 ring-1 ring-rose-200">فارسی ۴۵°: ۰ بدون · ۱ یک لبه · ۲ هر دو لبه</span>
        <span className="rounded bg-amber-50 px-2 py-1 ring-1 ring-amber-200">شیار: ۰ بدون · ۱ یک لبه · ۲ هر دو لبه</span>
        <span className="ms-auto">هاشور ضایعات: ناحیهٔ باقی‌ماندهٔ ورق (پرت) با هاشور مورب مشخص شده است</span>
      </div>
    </div>
  );
}
