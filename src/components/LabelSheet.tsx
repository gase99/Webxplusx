import type { PlacedPart } from '../algorithm';
import { getPlacementCode } from '../exportDxf';
import { getPartEdgeSides, type PartSide } from '../partEdges';
import type { CutPart } from '../types/part';

/**
 * A-Cut 2Dpro — لیبل قطعات (Labels)
 * ==================================
 * قطعات چیده‌شده را صفحه‌به‌صفحه در قالب شبکهٔ **۳ ستون × ۵ ردیف** روی A4
 * می‌چیند تا روی کاغذ برچسبی چاپ و بعد از برش روی هر قطعه چسبانده شود.
 * هر لیبل: کد قطعه (همان کد داخل فایل DXF)، نام، ابعاد نهایی، شمارهٔ ورق و
 * نمونه، عملیات کارگاهی به‌صورت متنی، و یک شماتیک کوچک از لبه‌ها.
 *
 * این کامپوننت هم در پیش‌نمایش روی صفحه و هم در سند چاپی (Print Portal)
 * استفاده می‌شود؛ اندازه‌ها با واحد mm واقعی‌اند تا در هر دو حالت یکسان باشد.
 */

const faNumber = new Intl.NumberFormat('fa-IR');

const LABELS_PER_PAGE = 15; // ۳ × ۵

interface LabelSheetProps {
  placements: PlacedPart[];
  /** ردیف‌های جدول (اسنپ‌شات زمان محاسبه) برای فلگ‌های کارگاهی و ابعاد اصلی */
  parts: CutPart[];
}

interface LabelEntry {
  placement: PlacedPart;
  indexInSheet: number;
  source?: CutPart;
}

/** خلاصهٔ متنی یک جفت فلگ طول/عرض: «طول و عرض» / «فقط طول» / «فقط عرض» / «ندارد» */
function describeFlags(lengthFlag: boolean, widthFlag: boolean): string {
  if (lengthFlag && widthFlag) return 'طول و عرض';
  if (lengthFlag) return 'فقط طول';
  if (widthFlag) return 'فقط عرض';
  return 'ندارد';
}

export default function LabelSheet({ placements, parts }: LabelSheetProps) {
  const partsById = new Map(parts.map((p) => [p.id, p]));

  // شمارهٔ هر قطعه داخل ورق خودش (برای کد S1-03 و…) — هم‌ترتیب با خروجی DXF
  const counters = new Map<number, number>();
  const entries: LabelEntry[] = placements.map((placement) => {
    const indexInSheet = counters.get(placement.sheetIndex) ?? 0;
    counters.set(placement.sheetIndex, indexInSheet + 1);
    return { placement, indexInSheet, source: partsById.get(placement.id) };
  });

  const pages: LabelEntry[][] = [];
  for (let i = 0; i < entries.length; i += LABELS_PER_PAGE) {
    pages.push(entries.slice(i, i + LABELS_PER_PAGE));
  }
  if (pages.length === 0) pages.push([]);

  return (
    <div className="label-sheet">
      {pages.map((page, pageIndex) => (
        <div key={pageIndex} className="label-page">
          {page.map((entry) => (
            <PartLabel key={`${entry.placement.id}-${entry.placement.sheetIndex}-${entry.indexInSheet}`} entry={entry} />
          ))}
          {/* خانه‌های خالیِ صفحهٔ آخر تا تراز شبکه روی کاغذ برچسبی حفظ شود */}
          {Array.from({ length: LABELS_PER_PAGE - page.length }).map((_, i) => (
            <div key={`empty-${i}`} className="rounded-[2mm] border border-dashed border-slate-200" />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PartLabel({ entry }: { entry: LabelEntry }) {
  const { placement: p, indexInSheet, source } = entry;
  const code = getPlacementCode(p.sheetIndex, indexInSheet);
  const name = (p.name ?? source?.name ?? '').trim() || 'بدون نام';
  const totalQty = source?.qty ?? p.instanceIndex;

  const ops = source
    ? [
        { label: 'نوار', value: describeFlags(source.bandLength, source.bandWidth), dot: '#0d9488', has: source.bandLength || source.bandWidth },
        { label: 'فارسی ۴۵°', value: describeFlags(source.farsiLength, source.farsiWidth), dot: '#dc2626', has: source.farsiLength || source.farsiWidth },
        { label: 'شیار', value: describeFlags(source.grooveLength, source.grooveWidth), dot: '#d97706', has: source.grooveLength || source.grooveWidth },
      ]
    : [];

  return (
    <article className="flex gap-[2.5mm] overflow-hidden rounded-[2mm] border border-dashed border-slate-400 bg-white p-[3mm] text-slate-800">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-[2mm]">
          <span
            dir="ltr"
            className="shrink-0 rounded-[1mm] bg-slate-800 px-[1.5mm] py-[0.5mm] font-mono text-[3mm] font-bold leading-none text-white"
          >
            {code}
          </span>
          <h4 className="truncate text-[4.2mm] font-extrabold leading-snug" title={name}>
            {name}
          </h4>
        </div>

        <p className="mt-[1.5mm] text-[3.4mm] leading-relaxed">
          ابعاد قطعه:{' '}
          <strong dir="ltr" className="tabular-nums">
            {(source?.length ?? p.width)} × {(source?.width ?? p.height)}
          </strong>{' '}
          <span className="text-slate-400">mm</span>
          {p.isRotated && (
            <span className="text-slate-500">
              {' '}— روی نقشه چرخیده:{' '}
              <span dir="ltr" className="tabular-nums">{p.width}×{p.height}</span>
            </span>
          )}
        </p>
        <p className="text-[3.2mm] leading-relaxed text-slate-600">
          ورق {faNumber.format(p.sheetIndex + 1)} · نمونهٔ {faNumber.format(p.instanceIndex)} از{' '}
          {faNumber.format(totalQty)} ·{' '}
          <span dir="ltr" className="tabular-nums text-slate-400">
            x:{p.x} y:{p.y}
          </span>
        </p>

        <ul className="mt-[1.5mm] space-y-[0.8mm] text-[3.1mm] leading-tight">
          {ops.map((op) => (
            <li key={op.label} className="flex items-center gap-[1.5mm]">
              <span
                className="inline-block h-[2mm] w-[2mm] shrink-0 rounded-full"
                style={{ backgroundColor: op.has ? op.dot : '#cbd5e1' }}
              />
              <span className={op.has ? 'font-bold text-slate-800' : 'text-slate-400'}>
                {op.label}: {op.has ? op.value : 'ندارد'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {source && (
        <div className="flex shrink-0 items-start pt-[1mm]">
          <MiniPartDiagram placement={p} source={source} />
        </div>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  شماتیک کوچک لبه‌ها روی لیبل (هم‌قرارداد با نقشهٔ برش)               */
/* ------------------------------------------------------------------ */

function MiniPartDiagram({ placement, source }: { placement: PlacedPart; source: CutPart }) {
  const W = 56;
  const H = 42;
  const margin = 5;
  const ratio = placement.width / Math.max(1, placement.height);
  let rw = W - margin * 2;
  let rh = rw / ratio;
  if (rh > H - margin * 2) {
    rh = H - margin * 2;
    rw = rh * ratio;
  }
  const x = (W - rw) / 2;
  const y = (H - rh) / 2;
  const sides = getPartEdgeSides(source, placement.isRotated);

  const lineFor = (side: PartSide, inset: number) => {
    switch (side) {
      case 'top':
        return { x1: x, y1: y + inset, x2: x + rw, y2: y + inset };
      case 'bottom':
        return { x1: x, y1: y + rh - inset, x2: x + rw, y2: y + rh - inset };
      case 'left':
        return { x1: x + inset, y1: y, x2: x + inset, y2: y + rh };
      case 'right':
        return { x1: x + rw - inset, y1: y, x2: x + rw - inset, y2: y + rh };
    }
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '17mm', height: 'auto' }} aria-hidden="true">
      <rect x={x} y={y} width={rw} height={rh} fill="#f8fafc" stroke="#64748b" strokeWidth="1.1" />
      {sides.groove.map((side) => (
        <line key={`g-${side}`} {...lineFor(side, 4)} stroke="#d97706" strokeWidth="1.6" strokeDasharray="4 2.4" />
      ))}
      {sides.band.map((side) => (
        <line key={`b-${side}`} {...lineFor(side, 1.4)} stroke="#0d9488" strokeWidth="2.8" />
      ))}
      {sides.farsi.map((side) => (
        <line key={`f-${side}`} {...lineFor(side, sides.band.includes(side) ? 3.6 : 1.2)} stroke="#dc2626" strokeWidth="2" strokeDasharray="5 2.6" />
      ))}
    </svg>
  );
}
