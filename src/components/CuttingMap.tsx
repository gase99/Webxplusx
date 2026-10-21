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
 * قرارداد خواندن نقشه (بازطراحی — همهٔ نوشته‌ها «داخل» خود قطعه):
 *  - بدنهٔ قطعه: سفید با حاشیهٔ مشکی؛ پرت/باقی‌ماندهٔ ورق: هاشور مورب.
 *  - مرکز قطعه با فونت درشت و مشکی: نام قطعه و زیر آن در دو خط جدا
 *    «طول: …» و «عرض: …». اگر قطعه چرخیده باشد متن مرکز هم ۹۰° می‌چرخد.
 *  - عملیات هر لبه با همان کلمه، داخل قطعه و موازی با همان لبه و چسبیده
 *    به آن نوشته می‌شود: «نوار» ‏/ «شیار» کنار لبه، و «فارسی ۴۵°» نزدیک
 *    گوشهٔ لبهٔ فارسی. مقدار ۲ یعنی هر دو لبهٔ موازی برچسب خودشان را دارند.
 *  - چند عملیات روی یک لبه: اگر عمق قطعه اجازه بدهد با فاصله از لبه
 *    «پله‌ای» به داخل چیده می‌شوند (یکی نزدیک لبه، دیگری عقب‌تر) وگرنه
 *    طول لبه بین آن‌ها تقسیم می‌شود تا روی هم نیفتند. همهٔ متن‌ها هالهٔ
 *    سفید دارند تا روی خط برش یا هاشور گم نشوند.
 *  - قطعهٔ خیلی کوچک (کوچک‌ترین بُعد کمتر از ۴۰mm): فقط ابعاد فشردهٔ
 *    «طول×عرض» در مرکز می‌آید و کلمه‌های عملیات حذف می‌شوند (شرح کامل
 *    عملیات در لیبل و برگهٔ کنترل هست).
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
  partFill: '#ffffff',
  partStroke: '#000000',
  text: '#000000',
};

const FONT_FAMILY = 'Vazirmatn, Tahoma, Arial, sans-serif';
const charCount = (str: string): number => [...str].length;

/** زیر این اندازه (mm واقعی قطعه) فقط ابعاد فشرده نوشته می‌شود، بدون کلمهٔ عملیات */
const SMALL_PART_MM = 40;

/* ------------------------------------------------------------------ */
/*  برچسب عملیات داخل قطعه، کنار لبهٔ مربوطه                           */
/* ------------------------------------------------------------------ */

type OperationKey = 'band' | 'groove' | 'farsi';

const OPERATION_LABEL: Record<OperationKey, string> = {
  band: 'نوار',
  groove: 'شیار',
  farsi: 'فارسی ۴۵°',
};

/** بردار رو به «داخل» قطعه برای هر لبه و بردار در امتداد لبه */
const INWARD: Record<Side, [number, number]> = {
  top: [0, 1],
  bottom: [0, -1],
  left: [1, 0],
  right: [-1, 0],
};
const TANGENT: Record<Side, [number, number]> = {
  top: [1, 0],
  bottom: [1, 0],
  left: [0, 1],
  right: [0, 1],
};

const PART_SIDES: Side[] = ['top', 'bottom', 'left', 'right'];

/**
 * اندازه‌های متن داخل قطعه — همه بر حسب «میلی‌مترِ نقشه» (واحد viewBox)
 * تا در هر اندازهٔ نمایش/چاپ، نسبتشان با ابعاد واقعی قطعه ثابت بماند.
 */
const EDGE_FONT_MAX_MM = 46;
const CENTER_FONT_MAX_MM = 46;
/** کمترین اندازهٔ خوانا برای کلمهٔ عملیات (mm نقشه) */
const EDGE_FONT_MIN_MM = 8;
/** کمترین اندازه برای متن‌های مرکز (mm نقشه) */
const CENTER_FONT_MIN_MM = 15;
/** کمترین اندازه برای «طول×عرض» فشرده در قطعات باریک (mm نقشه) */
const COMPACT_FONT_MIN_MM = 7;

interface EdgeLabelSpec {
  key: string;
  label: string;
  textX: number;
  textY: number;
  rotate?: string;
  fontSize: number;
}

/** عرض تقریبی یک متن با اندازهٔ فونت داده‌شده */
const textWidth = (label: string, fontSize: number): number => charCount(label) * fontSize * 0.6;

/**
 * برچسب‌های عملیات یک قطعه: برای هر لبهٔ دارای عملیات (۱ یا ۲)، کلمهٔ
 * عملیات «داخل» قطعه، موازی با همان لبه و با فاصلهٔ کم از آن نوشته می‌شود.
 *
 * مدیریت تداخل (Staggering):
 *  - اگر عمق قطعه برای همهٔ ردیف‌های دو لبهٔ روبه‌رو + متن مرکز کافی باشد،
 *    عملیات‌های یک لبه به‌صورت پله‌ای از لبه به داخل چیده می‌شوند
 *    (ردیف اول چسبیده به لبه، ردیف بعدی عقب‌تر).
 *  - اگر جا کم باشد، طول لبه بین عملیات‌ها تقسیم می‌شود (کنار هم روی لبه).
 *  - «فارسی ۴۵°» در هر دو حالت نزدیک گوشهٔ شروع همان لبه می‌نشیند.
 * برچسبی که حتی با کوچک‌ترین فونت خوانا هم در لبه جا نشود، رسم نمی‌شود.
 */
function buildEdgeLabels(
  placement: PlacedPartData,
  source: CutPart | undefined,
): EdgeLabelSpec[] {
  if (!source) return [];
  const { x, y, width: w, height: h, isRotated } = placement;
  const minDim = Math.min(w, h);

  // قطعهٔ خیلی کوچک: کلمهٔ عملیات کنار لبه جا نمی‌شود و نقشه را شلوغ می‌کند
  if (minDim < SMALL_PART_MM) return [];

  const sidesOf = (lengthCount: number, widthCount: number) =>
    sidesForFlags(lengthCount, widthCount, isRotated);
  const bandSides = sidesOf(source.bandLength, source.bandWidth);
  const grooveSides = sidesOf(source.grooveLength, source.grooveWidth);
  const farsiSides = sidesOf(source.farsiLength, source.farsiWidth);

  const opsOn = (side: Side): OperationKey[] => {
    // ترتیب ثابت: نوار، شیار، فارسی
    const ops: OperationKey[] = [];
    if (bandSides.includes(side)) ops.push('band');
    if (grooveSides.includes(side)) ops.push('groove');
    if (farsiSides.includes(side)) ops.push('farsi');
    return ops;
  };

  // اندازهٔ پایه از کوچک‌ترین بُعد قطعه مشتق می‌شود (همه بر حسب mm نقشه)
  const baseFont = Math.min(EDGE_FONT_MAX_MM, minDim * 0.17);
  const minReadable = EDGE_FONT_MIN_MM;
  if (baseFont < minReadable) return [];
  const rowH = baseFont * 1.32;

  /** آیا برای یک جفت لبهٔ روبه‌رو، چیدمان پله‌ای (به داخل) جا می‌شود؟ */
  const canStack = (sideA: Side, sideB: Side, depth: number): boolean =>
    depth >= (opsOn(sideA).length + opsOn(sideB).length) * rowH + baseFont * 2.7;
  const stackHorizontal = canStack('top', 'bottom', h);
  const stackVertical = canStack('left', 'right', w);

  const labels: EdgeLabelSpec[] = [];

  for (const side of PART_SIDES) {
    const ops = opsOn(side);
    if (ops.length === 0) continue;

    const horizontal = side === 'top' || side === 'bottom';
    const edgeLength = horizontal ? w : h;
    const [ix, iy] = INWARD[side];
    const stack = horizontal ? stackHorizontal : stackVertical;

    // نقطهٔ شروع لبه (گوشهٔ آغاز در جهت بردار مماس)
    const edgeStart: [number, number] = horizontal
      ? [x, side === 'top' ? y : y + h]
      : [side === 'left' ? x : x + w, y];
    const [tx, ty] = TANGENT[side];
    const at = (along: number, inwardDist: number): [number, number] => [
      edgeStart[0] + tx * along + ix * inwardDist,
      edgeStart[1] + ty * along + iy * inwardDist,
    ];

    ops.forEach((op, index) => {
      const label = OPERATION_LABEL[op];

      if (stack) {
        // ردیف پله‌ای از لبه به داخل؛ فاصلهٔ مرکز ردیف اول کمی بیشتر از نصف ارتفاع متن
        const inwardDist = baseFont * 0.78 + index * rowH;
        let font = Math.min(baseFont, (edgeLength * 0.94) / (charCount(label) * 0.6));
        if (font < minReadable) return;
        const along =
          op === 'farsi'
            ? // فارسی نزدیک گوشهٔ شروع لبه (ولی بیرون از قطعه نزند)
              Math.min(edgeLength / 2, textWidth(label, font) / 2 + font * 0.55)
            : edgeLength / 2;
        const [textX, textY] = at(along, inwardDist);
        labels.push({
          key: `${side}-${op}`,
          label,
          textX,
          textY,
          rotate: horizontal ? undefined : `rotate(-90 ${textX.toFixed(2)} ${textY.toFixed(2)})`,
          fontSize: font,
        });
      } else {
        // کنار هم روی یک ردیف: طول لبه بین عملیات‌ها تقسیم می‌شود
        const slot = edgeLength / ops.length;
        const font = Math.min(baseFont, (slot * 0.92) / (charCount(label) * 0.6));
        if (font < minReadable) return;
        // فارسی در اولین سهم (نزدیک گوشهٔ شروع) بماند؛ بقیه به‌ترتیب بعد از آن
        const order = op === 'farsi' ? 0 : ops.filter((o) => o !== 'farsi').indexOf(op) + (ops.includes('farsi') ? 1 : 0);
        const along = slot * (order + 0.5);
        const [textX, textY] = at(along, font * 0.78);
        labels.push({
          key: `${side}-${op}`,
          label,
          textX,
          textY,
          rotate: horizontal ? undefined : `rotate(-90 ${textX.toFixed(2)} ${textY.toFixed(2)})`,
          fontSize: font,
        });
      }
    });
  }

  return labels;
}

/* ------------------------------------------------------------------ */
/*  متن مرکز قطعه: نام + طول/عرض درشت و مشکی                           */
/* ------------------------------------------------------------------ */

interface CenterLines {
  lines: string[];
  fontSize: number;
}

/**
 * انتخاب هوشمند متن مرکز بر اساس فضای قطعه:
 *  - جادار: نام + «طول: …» + «عرض: …»
 *  - متوسط: فقط «طول: …» و «عرض: …»
 *  - کوچک (یا زیر ۴۰mm): فقط «طول×عرض» فشرده، بدون کلمهٔ اضافه
 *  - خیلی ریز: شمارهٔ نمونه
 */
function buildCenterLines(
  placement: PlacedPartData,
  source: CutPart | undefined,
  name: string,
): CenterLines | null {
  const { width: w, height: h, isRotated } = placement;
  // طول/عرض «خود قطعه» از جدول؛ بدون ردیف منبع، از روی جهت چیدمان
  const partLength = source?.length ?? (isRotated ? h : w);
  const partWidth = source?.width ?? (isRotated ? w : h);
  const lengthLine = `طول: ${partLength}`;
  const widthLine = `عرض: ${partWidth}`;
  const compactLine = `${partLength}×${partWidth}`;

  const availAlong = (isRotated ? h : w) * 0.92; // در امتداد خط متن (mm نقشه)
  const availAcross = (isRotated ? w : h) * 0.92; // عمود بر خط متن (mm نقشه)
  const smallPart = Math.min(w, h) < SMALL_PART_MM;

  const fitFont = (lines: string[], cap: number, acrossDivisor: number): number =>
    Math.min(
      cap,
      availAlong / (Math.max(...lines.map(charCount)) * 0.62),
      availAcross / acrossDivisor,
    );

  if (!smallPart) {
    const three = fitFont([name, lengthLine, widthLine], CENTER_FONT_MAX_MM, 3.9);
    if (three >= CENTER_FONT_MIN_MM) return { lines: [name, lengthLine, widthLine], fontSize: three };

    const two = fitFont([lengthLine, widthLine], CENTER_FONT_MAX_MM, 2.7);
    if (two >= CENTER_FONT_MIN_MM) return { lines: [lengthLine, widthLine], fontSize: two };
  }

  // نوارهای باریک (مثلاً ۱۲۰۰×۳۰): فقط «طول×عرض» در امتداد طول قطعه
  const compact = fitFont([compactLine], 40, 1.35);
  if (compact >= COMPACT_FONT_MIN_MM) return { lines: [compactLine], fontSize: compact };

  // آخرین تلاش برای قطعات غیرباریک: ابعاد دو خطی با فونت کوچک‌تر از آستانهٔ اصلی
  if (!smallPart) {
    const twoSmall = fitFont([lengthLine, widthLine], CENTER_FONT_MAX_MM, 2.7);
    if (twoSmall >= COMPACT_FONT_MIN_MM) return { lines: [lengthLine, widthLine], fontSize: twoSmall };
  }

  return null;
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

/** بدنهٔ قطعه + متن مرکز (نام/طول/عرض) + کلمه‌های عملیات کنار لبه‌ها — همه داخل قطعه */
function PlacedPart({ placement, source, scale: s }: PlacedPartProps) {
  const { x, y, width: w, height: h, isRotated } = placement;
  const cx = x + w / 2;
  const cy = y + h / 2;

  const name = (placement.name ?? source?.name ?? '').trim() || 'بدون نام';
  const mapDims = `${placement.width}×${placement.height}`;

  const center = buildCenterLines(placement, source, name);
  const edgeLabels = buildEdgeLabels(placement, source);

  const renderCenter = () => {
    const transform = isRotated ? `rotate(-90 ${cx} ${cy})` : undefined;
    if (!center) {
      if (Math.min(w, h) >= 14) {
        // فضای متن نیست؛ دست‌کم شمارهٔ نمونه را نشان بده
        return (
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={Math.min(30, Math.min(w, h) / 1.6)}
            fontWeight="800"
            fill={COLOR.text}
            pointerEvents="none"
            style={{ fontFamily: FONT_FAMILY }}
          >
            {placement.instanceIndex}
          </text>
        );
      }
      return null;
    }
    const { lines, fontSize } = center;
    const lineStep = fontSize * 1.18;
    return (
      <g transform={transform} pointerEvents="none">
        {lines.map((line, i) => (
          <text
            key={i}
            x={cx}
            y={cy + (i - (lines.length - 1) / 2) * lineStep}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={fontSize}
            fontWeight="800"
            fill={COLOR.text}
            stroke="#ffffff"
            strokeWidth={fontSize * 0.16}
            strokeLinejoin="round"
            paintOrder="stroke"
            style={{ fontFamily: FONT_FAMILY, direction: 'rtl' }}
          >
            {line}
          </text>
        ))}
      </g>
    );
  };

  const flagsSummary = source
    ? [
        (source.bandLength || source.bandWidth) && 'نوار',
        (source.farsiLength || source.farsiWidth) && 'فارسی ۴۵°',
        (source.grooveLength || source.grooveWidth) && 'شیار',
      ]
        .filter(Boolean)
        .join('، ')
    : '';

  return (
    <g>
      <title>
        {`${name} — نمونهٔ ${placement.instanceIndex} — ${mapDims} mm روی صفحهٔ ${placement.sheetIndex + 1} در (${placement.x}, ${placement.y})${isRotated ? ' — چرخیده ۹۰°' : ''}${flagsSummary ? ` — ${flagsSummary}` : ''}`}
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

      {/* کلمه‌های عملیات، داخل قطعه و کنار لبهٔ مربوطه */}
      <g className="part-edge-labels" pointerEvents="none">
        {edgeLabels.map((spec) => (
          <text
            key={spec.key}
            x={spec.textX}
            y={spec.textY}
            transform={spec.rotate}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={spec.fontSize}
            fontWeight="800"
            fill={COLOR.text}
            stroke="#ffffff"
            strokeWidth={spec.fontSize * 0.2}
            strokeLinejoin="round"
            paintOrder="stroke"
            style={{ fontFamily: FONT_FAMILY, direction: 'rtl' }}
          >
            {spec.label}
          </text>
        ))}
      </g>

      {/* نام و ابعاد در مرکز (بالای برچسب‌های لبه تا همیشه خوانا بماند) */}
      {renderCenter()}
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
  // حاشیهٔ حداقلی دور ورق فقط برای بریده‌نشدن خط دور ورق (نوشته‌ها داخل قطعه‌اند)
  const pad = Math.ceil(3 * scale);

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
              <rect x="1" y="1" width="26" height="18" fill="#fff" stroke="#000" strokeWidth="1.6" />
              <path d="M5 15.5h18M5 11.5h13" stroke="#000" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
            نام عملیات («نوار» / «شیار» / «فارسی ۴۵°») داخل قطعه و کنار همان لبه نوشته می‌شود
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
                </svg>
              </div>
            </div>
          </figure>
        ))}
      </div>

      {!forPrint && (
        <p className="mt-2 text-[11px] leading-5 text-slate-400">
          مبدأ نقشه (۰،۰) گوشهٔ شروع ورق است؛ محور افقی در جهت طول ورق و محور عمودی در جهت عرض آن.
          فاصله‌های باریک بین قطعات همان خوراک تیغه (Kerf) است. داخل هر قطعه نام و ابعادش
          («طول» و «عرض») نوشته شده و کلمهٔ عملیات هر لبه — نوار، شیار یا فارسی ۴۵° — داخل همان
          قطعه و کنار همان لبه آمده است؛ روی هر قطعه مکث کنید تا جزئیاتش را ببینید.
        </p>
      )}
    </div>
  );
}
