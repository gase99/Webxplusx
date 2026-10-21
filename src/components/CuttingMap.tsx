import { useId, useMemo, useState } from 'react';
import type {
  PlacedPart as PlacedPartData,
  SheetLayout,
  StockSheet,
} from '../algorithm';
import type { CutPart } from '../types/part';
import { sidesForFlags, type PartSide as Side } from '../partEdges';

/**
 * A-Cut 2Dpro — فاز ۳: نقشهٔ برش (Cutting Map)
 * ============================================
 * خروجی موتور فاز ۲ (sheets / placements) را با SVG رسم می‌کند.
 * واحد دستگاه مختصات خودِ میلی‌متر است (viewBox برابر ابعاد صفحهٔ خام)،
 * پس نقشه در هر اندازه‌ای بدون افت کیفیت و با حفظ نسبت ابعاد نمایش داده می‌شود.
 *
 * علائم کارگاهی (نسخهٔ ساده و خوانا):
 *  - بدنهٔ قطعه: سفید با حاشیهٔ مشکی
 *  - هر لبه‌ای که عملیات دارد (مقدار ۱ یا ۲): یک **پیکان مشکی در بیرون قطعه**
 *    که به همان لبه اشاره می‌کند + نام عملیات در کنار پیکان:
 *      «نوار» / «شیار» / «فارسی ۴۵°»
 *  - مقدار ۱ = یک پیکان روی یک لبه؛ مقدار ۲ = پیکان و متن جداگانه برای هر دو
 *    لبهٔ موازی. اگر چند عملیات روی یک لبه باشد، هر عملیات سهم خودش را روی
 *    همان لبه می‌گیرد تا پیکان‌ها و متن‌ها روی هم نیفتند.
 *  - پیکان/متن لبهٔ افقی افقی است و برای لبهٔ عمودی ۹۰ درجه می‌چرخد.
 *  - هیچ خط ضخیم/خط‌چین/مثلث یا متن عملیاتی داخل قطعه رسم نمی‌شود.
 *
 * نگاشت لبه‌ها هنگام چرخش: فلگ‌های «طول» یعنی دو لبهٔ موازی با محور طول قطعه.
 * اگر قطعه روی نقشه ۹۰ درجه چرخیده باشد (`isRotated`)، محور طول آن عمودی
 * می‌شود و لبه‌های طول همان لبه‌های چپ/راست‌اند (و لبه‌های عرض بالا/پایین).
 */

const faNumber = new Intl.NumberFormat('fa-IR');
const faDecimal = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });

const COLOR = {
  sheetBorder: '#000000',
  wasteFill: '#ffffff',
  wasteLine: '#666666',
  wasteLine2: '#000000',
  marker: '#000000',
  partFill: '#ffffff',
  partStroke: '#000000',
  text: '#000000',
};

/* ------------------------------------------------------------------ */
/*  علائم کارگاهی: پیکان + نام عملیات، بیرون قطعه                      */
/* ------------------------------------------------------------------ */

type OperationKey = 'band' | 'groove' | 'farsi';

const OPERATION_LABEL: Record<OperationKey, string> = {
  band: 'نوار',
  groove: 'شیار',
  farsi: 'فارسی ۴۵°',
};

/** بردارهای هر لبه: `n` رو به بیرون قطعه و `t` در امتداد لبه */
const SIDE_VECTORS: Record<Side, { n: [number, number]; t: [number, number] }> = {
  top: { n: [0, -1], t: [1, 0] },
  bottom: { n: [0, 1], t: [1, 0] },
  left: { n: [-1, 0], t: [0, 1] },
  right: { n: [1, 0], t: [0, 1] },
};

const PART_SIDES: Side[] = ['top', 'bottom', 'left', 'right'];

/** بزرگ‌ترین اندازهٔ متن علائم (میلی‌متر نقشه) */
const MARKER_FONT_MAX = 13;

/**
 * حاشیهٔ لازم دور ورق (میلی‌متر نقشه) تا پیکان‌ها و متن‌های بیرون قطعه‌های
 * چسبیده به لبهٔ ورق بریده نشوند. با `scale` هم‌واحد است.
 */
export function markerPadMm(scale: number): number {
  const font = MARKER_FONT_MAX * scale;
  // فاصله از لبه + طول پیکان + ارتفاع متن (با کمی اطمینان)
  return Math.ceil(font * (0.22 + 0.9 + 1.35));
}

/**
 * جای تک‌عملکردی هر لبه روی همان لبه (کسر طول لبه).
 * لبه‌های روبه‌رو با هم فرق دارند تا وقتی دو قطعه فقط به‌اندازهٔ تیغه فاصله
 * دارند، برچسب‌های بیرونی‌شان روی هم نیفتد.
 */
const SIDE_ANCHOR: Record<Side, number> = {
  top: 0.32,
  bottom: 0.68,
  left: 0.34,
  right: 0.66,
};

interface MarkerSpec {
  key: string;
  /** چندضلعی پیکان (رشتهٔ points) */
  points: string;
  label: string;
  textX: number;
  textY: number;
  /** چرخش متن برای لبهٔ عمودی */
  rotate?: string;
  fontSize: number;
}

/**
 * علامت‌های یک قطعه: برای هر لبهٔ دارای عملیات (۱ یا ۲)، یک پیکان مشکی در
 * **بیرون قطعه** که نوکش به لبه اشاره می‌کند + نام عملیات کنار آن.
 * چند عملیات روی یک لبه، طول لبه را بین خودشان تقسیم می‌کنند.
 */
function buildMarkers(
  placement: PlacedPartData,
  source: CutPart | undefined,
  s: number,
): MarkerSpec[] {
  if (!source) return [];
  const { x, y, width: w, height: h, isRotated } = placement;

  const sidesOf = (lengthCount: number, widthCount: number) =>
    sidesForFlags(lengthCount, widthCount, isRotated);
  const bandSides = sidesOf(source.bandLength, source.bandWidth);
  const grooveSides = sidesOf(source.grooveLength, source.grooveWidth);
  const farsiSides = sidesOf(source.farsiLength, source.farsiWidth);

  const markers: MarkerSpec[] = [];

  for (const side of PART_SIDES) {
    // ترتیب ثابت: نوار، شیار، فارسی
    const ops: OperationKey[] = [];
    if (bandSides.includes(side)) ops.push('band');
    if (grooveSides.includes(side)) ops.push('groove');
    if (farsiSides.includes(side)) ops.push('farsi');
    if (ops.length === 0) continue;

    const horizontal = side === 'top' || side === 'bottom';
    const edgeLength = horizontal ? w : h;
    const { n: normal, t: tangent } = SIDE_VECTORS[side];
    const [nx, ny] = normal;
    const [tx, ty] = tangent;
    const slot = edgeLength / ops.length; // سهم هر عملیات روی لبه

    ops.forEach((op, index) => {
      const label = OPERATION_LABEL[op];
      const chars = [...label].length;

      // اندازهٔ متن: خوانا، ولی داخل سهم همین عملیات روی لبه
      const font = Math.max(
        4.5 * s,
        Math.min(MARKER_FONT_MAX * s, (slot * 0.92) / (chars * 0.62)),
      );
      const arrowLen = Math.max(0.9 * font, 5 * s);
      const gap = Math.max(0.22 * font, 2 * s);
      const halfShaft = Math.min(Math.max(0.17 * font, 1.4 * s), slot * 0.16);
      const halfHead = Math.min(Math.max(halfShaft * 2.6, 1.6 * s), slot * 0.42);
      const headLen = arrowLen * 0.5;

      // نقطهٔ لنگر روی لبه (برای یک عملیات: لنگر ثابت هر لبه، برای چند عملیات: سهم‌بندی)
      const along =
        ops.length === 1 ? edgeLength * SIDE_ANCHOR[side] : slot * (index + 0.5);
      const ax = horizontal ? x + along : side === 'left' ? x : x + w;
      const ay = horizontal ? (side === 'top' ? y : y + h) : y + along;
      const at = (outward: number, lateral = 0): [number, number] => [
        ax + nx * outward + tx * lateral,
        ay + ny * outward + ty * lateral,
      ];

      // پیکان مشکی، نوک‌تیز به سمت لبه
      const points = [
        at(gap, 0),
        at(gap + headLen, -halfHead),
        at(gap + headLen, -halfShaft),
        at(gap + arrowLen, -halfShaft),
        at(gap + arrowLen, halfShaft),
        at(gap + headLen, halfShaft),
        at(gap + headLen, halfHead),
      ]
        .map(([px, py]) => `${px.toFixed(2)},${py.toFixed(2)}`)
        .join(' ');

      // متن بیرون‌تر از پیکان؛ لبهٔ عمودی ۹۰ درجه می‌چرخد
      const textOutward = gap + arrowLen + font * (horizontal ? 0.78 : 0.42);
      const [textX, textY] = at(textOutward);

      markers.push({
        key: `${side}-${op}`,
        points,
        label,
        textX,
        textY,
        rotate: horizontal ? undefined : `rotate(-90 ${textX.toFixed(2)} ${textY.toFixed(2)})`,
        fontSize: font,
      });
    });
  }

  return markers;
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

/** بدنهٔ قطعه + برچسب مرکز (نام/ابعاد)؛ علائم عملیات در لایهٔ جدا رسم می‌شوند */
function PlacedPart({ placement, source, scale: s }: PlacedPartProps) {
  const { x, y, width: w, height: h, isRotated } = placement;
  const cx = x + w / 2;
  const cy = y + h / 2;

  const bandSides = source ? sidesForFlags(source.bandLength, source.bandWidth, isRotated) : [];
  const farsiSides = source ? sidesForFlags(source.farsiLength, source.farsiWidth, isRotated) : [];
  const grooveSides = source ? sidesForFlags(source.grooveLength, source.grooveWidth, isRotated) : [];

  /* -------- متن مرکز قطعه: نام + ابعاد (شناسهٔ قطعه، نه علامت عملیات) -------- */
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
            stroke="#ffffff"
            strokeWidth={twoLineFont * 0.16}
            strokeLinejoin="round"
            paintOrder="stroke"
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
            stroke="#ffffff"
            strokeWidth={twoLineFont * 0.14}
            strokeLinejoin="round"
            paintOrder="stroke"
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
            stroke="#ffffff"
            strokeWidth={oneLineFont * 0.16}
            strokeLinejoin="round"
            paintOrder="stroke"
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
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={COLOR.partFill}
        stroke={COLOR.partStroke}
        strokeWidth={1.8 * s}
      />

      {renderLabel()}
    </g>
  );
}

/**
 * لایهٔ علائم: پیکان + نام عملیات برای همهٔ قطعه‌ها، **بالای** همهٔ بدنه‌ها
 * رسم می‌شود تا اگر برچسب بیرونی به قطعهٔ مجاور برسد، پشت بدنهٔ سفید آن
 * پنهان نشود (متن هالهٔ سفید دارد و خوانا می‌ماند).
 */
function MarkerLayer({
  placements,
  partsById,
  scale,
}: {
  placements: PlacedPartData[];
  partsById: Map<string, CutPart>;
  scale: number;
}) {
  return (
    <g className="part-markers" pointerEvents="none">
      {placements.flatMap((placement) =>
        buildMarkers(placement, partsById.get(placement.id), scale).map((marker) => (
          <g
            key={`${placement.id}-${placement.instanceIndex}-${placement.x}-${placement.y}-${marker.key}`}
          >
            <polygon
              points={marker.points}
              fill={COLOR.marker}
              stroke="#ffffff"
              strokeWidth={Math.max(0.9 * scale, 0.8)}
              strokeLinejoin="round"
            />
            <text
              x={marker.textX}
              y={marker.textY}
              transform={marker.rotate}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={marker.fontSize}
              fontWeight="700"
              fill={COLOR.marker}
              stroke="#ffffff"
              strokeWidth={marker.fontSize * 0.18}
              strokeLinejoin="round"
              paintOrder="stroke"
              style={{
                direction: 'rtl',
                fontFamily: 'Vazirmatn, Tahoma, Arial, sans-serif',
              }}
            >
              {marker.label}
            </text>
          </g>
        )),
      )}
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
  // حاشیهٔ دور ورق برای پیکان/متن‌های بیرون قطعه‌های کنارِ لبهٔ ورق
  const pad = markerPadMm(scale);

  if (sheets.length === 0) return null;

  return (
    <div className="cutting-map mt-4">
      {/* سربرگ نقشه: راهنمای علائم + زوم */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h3 className="text-sm font-extrabold text-slate-800">
          🗺️ نقشهٔ برش
          <span className="ms-2 text-xs font-medium text-slate-400" dir="ltr">
            Cutting Map (SVG)
          </span>
        </h3>

        <ul className="map-legend flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-700">
          <li className="flex items-center gap-1">
            <svg viewBox="0 0 28 20" className="h-4 w-7" aria-hidden="true">
              <line x1="1" y1="18" x2="27" y2="18" stroke="#000" strokeWidth="2" />
              <polygon points="14,17 9,7 12,7 12,1 16,1 16,7 19,7" fill="#000" />
            </svg>
            پیکان بیرون لبه = عملیات آن لبه: «نوار» / «شیار» / «فارسی ۴۵°»
          </li>
          <li className="flex items-center gap-1">
            <svg viewBox="0 0 24 16" className="h-4 w-6" aria-hidden="true">
              <rect x="1" y="1" width="22" height="14" fill="#fff" stroke="#000" />
              <path d="M3 14 12 2 M11 14 20 2" stroke="#555" strokeWidth="1.5" />
            </svg>
            <span className="font-bold">هاشور ضایعات</span> / باقی‌ماندهٔ ورق
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
      <div className="print-sheets mt-3 space-y-4">
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
              <span className="rounded-md bg-white px-2 py-0.5 text-xs font-bold text-black ring-1 ring-black">
                بهره‌وری {faDecimal.format(sheet.utilizationPercentage)}٪
              </span>
              <span className="rounded-md bg-white px-2 py-0.5 text-xs font-bold text-black ring-1 ring-black">
                پرت {faDecimal.format(sheet.wastePercentage)}٪
              </span>
              <span className="ms-auto text-xs font-medium text-slate-500">
                {faNumber.format(sheet.placements.length)} قطعه
              </span>
            </figcaption>

            <div className="table-scroll overflow-x-auto p-3">
              <div className="mx-auto" style={{ width: `${effectiveZoom}%`, minWidth: effectiveZoom > 100 ? undefined : 300 }}>
                <svg
                  viewBox={`${-pad} ${-pad} ${stock.length + 2 * pad} ${stock.width + 2 * pad}`}
                  className="block h-auto w-full"
                  role="img"
                  aria-label={`نقشهٔ برش صفحهٔ ${sheet.sheetIndex + 1}`}
                >
                  <defs>
                    {/* هاشور ضایعات — لایهٔ اول: هاشور مورب ۴۵° */}
                    <pattern
                      id={`${patternId}-waste`}
                      patternUnits="userSpaceOnUse"
                      width={20 * scale}
                      height={20 * scale}
                      patternTransform="rotate(45)"
                    >
                      <rect width={20 * scale} height={20 * scale} fill={COLOR.wasteFill} />
                      <line x1={0} y1={0} x2={0} y2={20 * scale} stroke={COLOR.wasteLine} strokeWidth={5 * scale} />
                    </pattern>
                    {/* هاشور ضایعات — لایهٔ دوم: هاشور متقاطع برای وضوح بیشتر */}
                    <pattern
                      id={`${patternId}-waste2`}
                      patternUnits="userSpaceOnUse"
                      width={24 * scale}
                      height={24 * scale}
                      patternTransform="rotate(-45)"
                    >
                      <rect width={24 * scale} height={24 * scale} fill="transparent" />
                      <line x1={0} y1={0} x2={0} y2={24 * scale} stroke={COLOR.wasteLine2} strokeWidth={2.2 * scale} strokeDasharray={`${3 * scale} ${4 * scale}`} opacity="0.6" />
                    </pattern>
                  </defs>

                  {/* بدنهٔ ورق خام: پس‌زمینه‌اش همان پرت/باقی‌مانده است — هاشور ضایعات دو لایه */}
                  <rect x={0} y={0} width={stock.length} height={stock.width} fill={`url(#${patternId}-waste)`} stroke={COLOR.sheetBorder} strokeWidth={2.4 * scale} />
                  <rect x={0} y={0} width={stock.length} height={stock.width} fill={`url(#${patternId}-waste2)`} stroke="none" opacity="0.9" />

                  {sheet.placements.map((placement) => (
                    <PlacedPart
                      key={`${placement.id}-${placement.instanceIndex}-${placement.x}-${placement.y}`}
                      placement={placement}
                      source={partsById.get(placement.id)}
                      scale={scale}
                    />
                  ))}

                  {/* علائم عملیات بالای همهٔ قطعه‌ها */}
                  <MarkerLayer
                    placements={sheet.placements}
                    partsById={partsById}
                    scale={scale}
                  />
                </svg>
              </div>
            </div>
          </figure>
        ))}
      </div>

      {!forPrint && (
        <p className="mt-2 text-[11px] leading-5 text-slate-400">
          مبدأ نقشه (۰،۰) گوشهٔ شروع ورق است؛ محور افقی در جهت طول ورق و محور عمودی در جهت عرض آن.
          فاصله‌های باریک بین قطعات همان خوراک تیغه (Kerf) است. پیکان بیرون هر لبه، عملیات همان لبه را
          نشان می‌دهد؛ روی هر قطعه مکث کنید تا جزئیاتش (مختصات، چرخش و عملیات کارگاهی) را ببینید.
        </p>
      )}
    </div>
  );
}
