import { useId, useMemo, useState } from 'react';
import type {
  PlacedPart as PlacedPartData,
  SheetLayout,
  StockSheet,
} from '../algorithm';
import type { CutPart } from '../types/part';
import { GROOVE_INSET_MM, sidesForFlags, type PartSide as Side } from '../partEdges';
import { BandIcon, FarsiIcon, GrooveIcon } from './icons';

/**
 * A-Cut 2Dpro — فاز ۳: نقشهٔ برش (Cutting Map)
 * ============================================
 * خروجی موتور فاز ۲ (sheets / placements) را با SVG رسم می‌کند.
 * واحد دستگاه مختصات خودِ میلی‌متر است (viewBox برابر ابعاد صفحهٔ خام)،
 * پس نقشه در هر اندازه‌ای بدون افت کیفیت و با حفظ نسبت ابعاد نمایش داده می‌شود.
 *
 * قرارداد رندر علائم کارگاهی (طبق قرارداد فاز ۱) برای هر قطعه از روی ردیف
 * متناظر همان قطعه (`id`) در جدول خوانده می‌شود:
 *  - نوار  : خط ضخیم سبزآبی روی لبه
 *  - فارسی: خط‌چین قرمز روی لبه + مثلث کوچک + برچسب «45°»
 *  - شیار  : خط‌چین کهربایی در فاصلهٔ ~۱۰ میلی‌متر داخل قطعه، موازی لبه
 *
 * نگاشت لبه‌ها هنگام چرخش: فلگ‌های «طول» یعنی دو لبهٔ موازی با محور طول قطعه.
 * اگر قطعه روی نقشه ۹۰ درجه چرخیده باشد (`isRotated`)، محور طول آن عمودی
 * می‌شود و لبه‌های طول همان لبه‌های چپ/راست‌اند (و لبه‌های عرض بالا/پایین).
 */

const faNumber = new Intl.NumberFormat('fa-IR');
const faDecimal = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });

const COLOR = {
  sheetBorder: '#1e293b',
  wasteFill: '#eef2f7',
  wasteLine: '#dde4ee',
  band: '#0d9488', // teal-600
  farsi: '#dc2626', // red-600 — روی همهٔ پس‌زمینه‌ها خوانا بماند
  farsiFill: '#fecdd3',
  groove: '#d97706', // amber-600
  text: '#1e293b',
};

/** پالت ثابت و ملایم؛ همهٔ نمونه‌های یک ردیف (id یکسان) هم‌رنگ رسم می‌شوند */
const PALETTE: [fill: string, stroke: string][] = [
  ['#dbeafe', '#3b82f6'],
  ['#dcfce7', '#22c55e'],
  ['#fef9c3', '#ca8a04'],
  ['#ffe4e6', '#f43f5e'],
  ['#e0e7ff', '#6366f1'],
  ['#ccfbf1', '#0d9488'],
  ['#ffedd5', '#ea580c'],
  ['#f3e8ff', '#9333ea'],
  ['#e2e8f0', '#64748b'],
  ['#fce7f3', '#db2777'],
  ['#ecfccb', '#65a30d'],
  ['#cffafe', '#0891b2'],
];

function colorForPart(id: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}


/* ------------------------------------------------------------------ */
/*  رسم یک قطعهٔ چیده‌شده                                              */
/* ------------------------------------------------------------------ */

interface PlacedPartProps {
  placement: PlacedPartData;
  /** ردیف متناظر در جدول برای فلگ‌های نوار/فارسی/شیار */
  source?: CutPart;
  /** ضریب مقیاس: چند میلی‌متر به‌ازای هر «پیکسل اسمی» در نمایش ۱۰۰۰ پیکسلی */
  scale: number;
}

function PlacedPart({ placement, source, scale: s }: PlacedPartProps) {
  const { x, y, width: w, height: h, isRotated } = placement;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const [fill, stroke] = colorForPart(placement.id);

  const bandSides = source ? sidesForFlags(source.bandLength, source.bandWidth, isRotated) : [];
  const farsiSides = source ? sidesForFlags(source.farsiLength, source.farsiWidth, isRotated) : [];
  const grooveSides = source ? sidesForFlags(source.grooveLength, source.grooveWidth, isRotated) : [];

  /* ضخامت‌ها (بر حسب میلی‌متر نقشه، مقیاس‌شده نسبت به اندازهٔ ورق) */
  const bandStroke = 3.4 * s;
  const farsiStroke = 2.6 * s;
  const grooveStroke = 2 * s;

  /** مختصات خط موازی یک لبه با فاصلهٔ inset به داخل قطعه */
  const lineFor = (side: Side, inset: number) => {
    const trim = 1 * s;
    switch (side) {
      case 'top':
        return { x1: x + trim, y1: y + inset, x2: x + w - trim, y2: y + inset };
      case 'bottom':
        return { x1: x + trim, y1: y + h - inset, x2: x + w - trim, y2: y + h - inset };
      case 'left':
        return { x1: x + inset, y1: y + trim, x2: x + inset, y2: y + h - trim };
      case 'right':
        return { x1: x + w - inset, y1: y + trim, x2: x + w - inset, y2: y + h - trim };
    }
  };

  /* فاصلهٔ داخلی هر علامت؛ اگر چند علامت روی یک لبه باشند پشت سر هم می‌نشینند */
  const bandInset = bandStroke / 2 + 0.5 * s;
  const farsiInsetFor = (side: Side) =>
    bandSides.includes(side)
      ? bandInset + bandStroke / 2 + farsiStroke / 2 + 1.4 * s
      : farsiStroke / 2 + 0.5 * s;
  const grooveInsetFor = (side: Side) => {
    let inset = Math.min(GROOVE_INSET_MM, Math.min(w, h) / 4); // ~۱۰ میلی‌متر واقعی داخل قطعه
    if (bandSides.includes(side)) inset = Math.max(inset, bandInset + bandStroke / 2 + 2.2 * s);
    if (farsiSides.includes(side)) inset = Math.max(inset, farsiInsetFor(side) + farsiStroke / 2 + 2.2 * s);
    return inset;
  };

  /** نشانگر فارسی: مثلث قائم‌الزاویهٔ کوچک + برچسب 45° در میانهٔ لبه */
  const renderFarsiMarker = (side: Side) => {
    const edgeLength = side === 'top' || side === 'bottom' ? w : h;
    if (edgeLength < 20 * s) return null; // قطعه خیلی کوچک است؛ خط‌چین قرمز کافی است

    const t = 9 * s; // اندازهٔ مثلث
    const inset = farsiInsetFor(side);
    // جهت «داخل قطعه» و «در امتداد لبه» برای هر ضلع
    const normal: Record<Side, [number, number]> = {
      top: [0, 1],
      bottom: [0, -1],
      left: [1, 0],
      right: [-1, 0],
    };
    const tangent: Record<Side, [number, number]> = {
      top: [1, 0],
      bottom: [1, 0],
      left: [0, 1],
      right: [0, 1],
    };
    const edgeMid: Record<Side, [number, number]> = {
      top: [cx, y],
      bottom: [cx, y + h],
      left: [x, cy],
      right: [x + w, cy],
    };
    const [nx, ny] = normal[side];
    const [tx, ty] = tangent[side];
    const [mx, my] = edgeMid[side];

    const triX = mx + nx * (inset + t * 0.95);
    const triY = my + ny * (inset + t * 0.95);
    const labelX = triX + tx * (t * 1.15);
    const labelY = triY + ty * (t * 1.15);
    const angle: Record<Side, number> = { top: 0, right: 90, bottom: 180, left: 270 };

    return (
      <g key={`farsi-marker-${side}`}>
        <g transform={`translate(${triX} ${triY}) rotate(${angle[side]})`}>
          <polygon
            points={`${-t / 2},${t / 2} ${t / 2},${t / 2} ${t / 2},${-t / 2}`}
            fill={COLOR.farsiFill}
            stroke={COLOR.farsi}
            strokeWidth={0.9 * s}
            strokeLinejoin="round"
          />
          {/* وتر مورب = خودِ خط برش ۴۵ درجه */}
          <line
            x1={-t / 2}
            y1={t / 2}
            x2={t / 2}
            y2={-t / 2}
            stroke={COLOR.farsi}
            strokeWidth={1.6 * s}
            strokeLinecap="round"
          />
        </g>
        <text
          x={labelX}
          y={labelY}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={9.5 * s}
          fontWeight="800"
          fill={COLOR.farsi}
          style={{ direction: 'ltr' }}
        >
          45°
        </text>
      </g>
    );
  };

  /* -------- متن مرکز قطعه: نام + ابعاد، با کوچک‌شدن هوشمند -------- */
  const name = (placement.name ?? source?.name ?? '').trim() || 'بدون نام';
  const dims = `${placement.width}×${placement.height}`;
  const rotateText = isRotated;
  const availAlong = (rotateText ? h : w) * 0.92; // در امتداد خط متن
  const availAcross = (rotateText ? w : h) * 0.92; // عمود بر خط متن
  const charCount = (str: string) => [...str].length;
  const minFont = 6.5 * s;

  const twoLineFont = Math.min(
    13 * s,
    availAlong / (Math.max(charCount(name), charCount(dims)) * 0.58),
    availAcross / 2.9,
  );
  const oneLineFont = Math.min(
    11 * s,
    availAlong / (charCount(dims) * 0.58),
    availAcross / 1.45,
  );

  const renderLabel = () => {
    const transform = rotateText ? `rotate(-90 ${cx} ${cy})` : undefined;
    if (twoLineFont >= minFont) {
      return (
        <g transform={transform} pointerEvents="none">
          <text
            x={cx}
            y={cy - twoLineFont * 0.62}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={twoLineFont}
            fontWeight="700"
            fill={COLOR.text}
          >
            {name}
          </text>
          <text
            x={cx}
            y={cy + twoLineFont * 0.72}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={twoLineFont * 0.88}
            fill={COLOR.text}
            style={{ direction: 'ltr' }}
          >
            {dims}
          </text>
        </g>
      );
    }
    if (oneLineFont >= minFont) {
      return (
        <g transform={transform} pointerEvents="none">
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={oneLineFont}
            fontWeight="600"
            fill={COLOR.text}
            style={{ direction: 'ltr' }}
          >
            {dims}
          </text>
        </g>
      );
    }
    if (Math.min(w, h) >= 13 * s) {
      // فضای متن نیست؛ دست‌کم شمارهٔ نمونه را نشان بده
      return (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={Math.min(10 * s, Math.min(w, h) / 1.7)}
          fontWeight="700"
          fill={COLOR.text}
          pointerEvents="none"
        >
          {placement.instanceIndex}
        </text>
      );
    }
    return null;
  };

  const flagsSummary = [
    bandSides.length > 0 && 'نوار',
    farsiSides.length > 0 && 'فارسی ۴۵°',
    grooveSides.length > 0 && 'شیار',
  ]
    .filter(Boolean)
    .join('، ');

  return (
    <g>
      <title>
        {`${name} — نمونهٔ ${placement.instanceIndex} — ${dims} mm روی صفحهٔ ${placement.sheetIndex + 1} در (${placement.x}, ${placement.y})${isRotated ? ' — چرخیده ۹۰°' : ''}${flagsSummary ? ` — ${flagsSummary}` : ''}`}
      </title>

      {/* بدنهٔ قطعه */}
      <rect x={x} y={y} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={1.1 * s} />

      {/* شیار: خط‌چین کهربایی موازی لبه و داخل قطعه */}
      {grooveSides.map((side) => {
        const inset = grooveInsetFor(side);
        if (inset >= Math.min(w, h) / 2) return null;
        const l = lineFor(side, inset);
        return (
          <line
            key={`groove-${side}`}
            {...l}
            stroke={COLOR.groove}
            strokeWidth={grooveStroke}
            strokeDasharray={`${6 * s} ${4 * s}`}
            strokeLinecap="round"
          />
        );
      })}

      {/* نوار: خط ضخیم سبزآبی روی لبه */}
      {bandSides.map((side) => {
        const l = lineFor(side, bandInset);
        return <line key={`band-${side}`} {...l} stroke={COLOR.band} strokeWidth={bandStroke} />;
      })}

      {/* فارسی: خط‌چین قرمز روی لبه + مثلث و برچسب 45° */}
      {farsiSides.map((side) => {
        const l = lineFor(side, farsiInsetFor(side));
        return (
          <line
            key={`farsi-${side}`}
            {...l}
            stroke={COLOR.farsi}
            strokeWidth={farsiStroke}
            strokeDasharray={`${9 * s} ${5 * s}`}
          />
        );
      })}
      {farsiSides.map(renderFarsiMarker)}

      {renderLabel()}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/*  نقشهٔ کامل همهٔ صفحه‌ها                                            */
/* ------------------------------------------------------------------ */

interface CuttingMapProps {
  sheets: SheetLayout[];
  stock: StockSheet;
  /** ردیف‌های جدول (اسنپ‌شات زمان محاسبه) برای خواندن فلگ‌های کارگاهی با id */
  parts: CutPart[];
  /** حالت سند چاپی: بدون کنترل زوم و یادداشت تعاملی، زوم ثابت ۱۰۰٪ */
  forPrint?: boolean;
}

export default function CuttingMap({ sheets, stock, parts, forPrint = false }: CuttingMapProps) {
  const [zoom, setZoom] = useState(100);
  const effectiveZoom = forPrint ? 100 : zoom;
  const patternId = useId().replace(/[^a-zA-Z0-9]/g, '');

  const partsById = useMemo(() => new Map(parts.map((p) => [p.id, p])), [parts]);

  // چند میلی‌متر به‌ازای هر پیکسل اسمی اگر ورق با عرض ~۱۰۰۰ پیکسل دیده شود
  const scale = Math.max(stock.length, stock.width) / 1000;

  if (sheets.length === 0) return null;

  return (
    <div className="mt-4">
      {/* سربرگ نقشه: راهنمای علائم + زوم */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h3 className="text-sm font-extrabold text-slate-800">
          🗺️ نقشهٔ برش
          <span className="ms-2 text-xs font-medium text-slate-400" dir="ltr">
            Cutting Map (SVG)
          </span>
        </h3>

        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-600">
          <li className="flex items-center gap-1">
            <BandIcon active className="h-4 w-4" /> نوار: خط ضخیم سبزآبی
          </li>
          <li className="flex items-center gap-1">
            <FarsiIcon active className="h-4 w-4" />
            <span>
              فارسی: خط‌چین <span className="text-rose-700">قرمز</span> + مثلث + 45°
            </span>
          </li>
          <li className="flex items-center gap-1">
            <GrooveIcon active className="h-4 w-4" /> شیار: خط‌چین کهربایی داخل قطعه
          </li>
          <li className="flex items-center gap-1">
            <span className="inline-block h-3.5 w-5 rounded-sm bg-slate-200 ring-1 ring-slate-300" /> پرت / باقی‌ماندهٔ ورق
          </li>
        </ul>

        {!forPrint && (
        <div className="ms-auto flex items-center gap-1" role="group" aria-label="زوم نقشه">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(50, z - 25))}
            disabled={zoom <= 50}
            className="h-8 w-8 rounded-lg bg-white text-base font-black text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-100 disabled:opacity-40"
            aria-label="کوچک‌نمایی"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setZoom(100)}
            className="h-8 min-w-[68px] rounded-lg bg-white px-2 text-xs font-bold tabular-nums text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-100"
            title="بازنشانی زوم (برازش با عرض)"
          >
            {faNumber.format(zoom)}٪
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(300, z + 25))}
            disabled={zoom >= 300}
            className="h-8 w-8 rounded-lg bg-white text-base font-black text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-100 disabled:opacity-40"
            aria-label="بزرگ‌نمایی"
          >
            +
          </button>
        </div>
        )}
      </div>

      {/* یک نما برای هر ورق خام */}
      <div className="mt-3 space-y-4">
        {sheets.map((sheet) => (
          <figure
            key={sheet.sheetIndex}
            className="print-sheet overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-slate-300/80 [break-inside:avoid]"
          >
            <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-200 bg-white px-4 py-2.5 text-sm">
              <strong className="font-extrabold text-slate-800">
                صفحهٔ {faNumber.format(sheet.sheetIndex + 1)}
                <span className="ms-1.5 text-xs font-medium text-slate-400">
                  از {faNumber.format(sheets.length)}
                </span>
              </strong>
              <span className="tabular-nums text-xs text-slate-500" dir="ltr">
                {stock.length} × {stock.width} mm
              </span>
              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                بهره‌وری {faDecimal.format(sheet.utilizationPercentage)}٪
              </span>
              <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 ring-1 ring-rose-200">
                پرت {faDecimal.format(sheet.wastePercentage)}٪
              </span>
              <span className="ms-auto text-xs font-medium text-slate-500">
                {faNumber.format(sheet.placements.length)} قطعه
              </span>
            </figcaption>

            <div className="table-scroll overflow-x-auto p-3">
              <div className="mx-auto" style={{ width: `${effectiveZoom}%`, minWidth: effectiveZoom > 100 ? undefined : 300 }}>
                <svg
                  viewBox={`0 0 ${stock.length} ${stock.width}`}
                  className="block h-auto w-full"
                  role="img"
                  aria-label={`نقشهٔ برش صفحهٔ ${sheet.sheetIndex + 1}`}
                >
                  <defs>
                    <pattern
                      id={`${patternId}-waste`}
                      patternUnits="userSpaceOnUse"
                      width={20 * scale}
                      height={20 * scale}
                      patternTransform="rotate(45)"
                    >
                      <rect width={20 * scale} height={20 * scale} fill={COLOR.wasteFill} />
                      <line
                        x1={0}
                        y1={0}
                        x2={0}
                        y2={20 * scale}
                        stroke={COLOR.wasteLine}
                        strokeWidth={5 * scale}
                      />
                    </pattern>
                  </defs>

                  {/* بدنهٔ ورق خام: پس‌زمینه‌اش همان پرت/باقی‌مانده است */}
                  <rect
                    x={0}
                    y={0}
                    width={stock.length}
                    height={stock.width}
                    fill={`url(#${patternId}-waste)`}
                    stroke={COLOR.sheetBorder}
                    strokeWidth={2.4 * scale}
                  />

                  {sheet.placements.map((placement) => (
                    <PlacedPart
                      key={`${placement.id}-${placement.instanceIndex}-${placement.x}-${placement.y}`}
                      placement={placement}
                      source={partsById.get(placement.id)}
                      scale={scale}
                    />
                  ))}
                </svg>
              </div>
            </div>
          </figure>
        ))}
      </div>

      {!forPrint && (
      <p className="mt-2 text-[11px] leading-5 text-slate-400">
        مبدأ نقشه (۰،۰) گوشهٔ شروع ورق است؛ محور افقی در جهت طول ورق و محور عمودی در جهت عرض آن.
        فاصله‌های باریک بین قطعات همان خوراک تیغه (Kerf) است. روی هر قطعه مکث کنید تا جزئیاتش
        (مختصات، چرخش و عملیات کارگاهی) را ببینید.
      </p>
      )}
    </div>
  );
}
