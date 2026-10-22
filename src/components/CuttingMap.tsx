import { useId, useMemo, useState } from 'react';
import type {
  PlacedPart as PlacedPartData,
  SheetLayout,
  StockSheet,
} from '../algorithm';
import type { CutPart } from '../types/part';

/**
 * A-Cut 2Dpro — فاز ۳: نقشهٔ برش (Cutting Map)
 * ============================================
 * خروجی موتور فاز ۲ (sheets / placements) را با SVG رسم می‌کند.
 * واحد دستگاه مختصات خودِ میلی‌متر است (viewBox برابر ابعاد صفحهٔ خام)،
 * پس نقشه در هر اندازه‌ای بدون افت کیفیت و با حفظ نسبت ابعاد نمایش داده می‌شود.
 *
 * قرارداد خواندن نقشه (بازطراحی — علائم خطی استاندارد زیر ابعاد):
 *  - بدنهٔ قطعه: سفید با حاشیهٔ مشکی؛ پرت/باقی‌ماندهٔ ورق: هاشور مورب.
 *  - مرکز قطعه با فونت درشت و مشکی: نام قطعه و زیر آن در دو خط جدا
 *    «طول: …» و «عرض: …». اگر قطعه چرخیده باشد همهٔ بلوک مرکزی (متن و
 *    خط‌های علائم) هم ۹۰° می‌چرخد.
 *  - عملیات لبه‌ها با «علامت» دقیقاً زیر عدد همان جهت نشان داده می‌شود
 *    (راهنمایش بالای نقشه است): خط ممتد ضخیم = نوار، خط‌چین = شیار و
 *    حرف «ف» کنار عدد = برش فارسی ۴۵°. برای دو لبه، علامت دوتایی می‌شود
 *    (دو خط ممتد / دو خط‌چین / «ف ف»). علائم زیر «طول» مربوط به دو لبهٔ
 *    جهت طول قطعه و زیر «عرض» مربوط به جهت عرض‌اند؛ اگر جهتی هم نوار
 *    داشته باشد هم شیار، خط‌هایشان زیر هم چیده می‌شوند.
 *  - قطعهٔ خیلی کوچک (کوچک‌ترین بُعد کمتر از ۴۰mm): فقط ابعاد فشردهٔ
 *    «طول×عرض» در مرکز می‌آید و علائم حذف می‌شوند (شرح کامل عملیات در
 *    لیبل و برگهٔ کنترل هست).
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

/** زیر این اندازه (mm واقعی قطعه) فقط ابعاد فشرده نوشته می‌شود، بدون علائم عملیات */
const SMALL_PART_MM = 40;

/* ------------------------------------------------------------------ */
/*  متن مرکز قطعه: نام + ابعاد درشت + علائم عملیات زیر هر عدد          */
/* ------------------------------------------------------------------ */

/**
 * اندازه‌های متن داخل قطعه — همه بر حسب «میلی‌مترِ نقشه» (واحد viewBox)
 * تا در هر اندازهٔ نمایش/چاپ، نسبتشان با ابعاد واقعی قطعه ثابت بماند.
 */
const CENTER_FONT_MAX_MM = 46;
/** کمترین اندازه برای متن‌های مرکز (mm نقشه) */
const CENTER_FONT_MIN_MM = 15;
/** کمترین اندازه برای «طول×عرض» فشرده در قطعات باریک (mm نقشه) */
const COMPACT_FONT_MIN_MM = 7;
/** کمترین اندازه برای ابعاد دو خطی همراه علائم (قبل از رفتن به حالت فشرده) */
const DIMS_FONT_MIN_MM = 8.5;

/** عرض تقریبی یک متن با اندازهٔ فونت داده‌شده */
const textWidth = (label: string, fontSize: number): number => charCount(label) * fontSize * 0.6;

/**
 * یک خط از بلوک مرکزی قطعه. برای خط‌های ابعاد، علائم عملیات همان جهت
 * زیر عدد رسم می‌شوند:
 *  - نوار: خط ممتد ضخیم (۲ لبه = دو خط ممتد)
 *  - شیار: خط‌چین (۲ لبه = دو خط‌چین)
 *  - فارسی: حرف «ف» کنار عدد در همان رشتهٔ متن (۲ لبه = «ف ف»)
 */
interface CenterLineSpec {
  text: string;
  /** تعداد خط‌های ممتد (نوار) زیر عدد: ۰/۱/۲ */
  band: number;
  /** تعداد خط‌های چین‌دار (شیار) زیر عدد: ۰/۱/۲ */
  groove: number;
  /** رشتهٔ عددی که خط‌ها دقیقاً زیر آن کشیده می‌شوند (فقط خط‌های ابعاد) */
  digitText?: string;
  /** پسوند «ف»ها که در متنِ خط بعد از عدد آمده (برای پیدا کردن مرکز عدد) */
  farsiSuffix?: string;
}

interface CenterSpec {
  lines: CenterLineSpec[];
  fontSize: number;
}

/* هندسهٔ علائم — همه نسبت به اندازهٔ فونت (واحد em) تا با هر فونتی متناسب بمانند */
const SYM_FIRST_EM = 0.66; // فاصلهٔ مرکز متن تا اولین خط علامت
const SYM_STEP_EM = 0.26; // فاصلهٔ خط‌های علامت از هم
const SYM_GROUP_GAP_EM = 0.12; // فاصلهٔ اضافه بین گروه نوار و شیار

const symRowsOf = (line: CenterLineSpec): number => line.band + line.groove;

/** فاصلهٔ مرکز متن یک خط تا پایین آخرین علامتش (em) */
const symBottomEm = (line: CenterLineSpec): number => {
  const rows = symRowsOf(line);
  if (rows === 0) return 0.5;
  return (
    SYM_FIRST_EM +
    (rows - 1) * SYM_STEP_EM +
    (line.band > 0 && line.groove > 0 ? SYM_GROUP_GAP_EM : 0) +
    0.08
  );
};

/** فاصلهٔ مرکز یک خط تا مرکز خط بعدی (em) */
const stepEmOf = (line: CenterLineSpec): number => symBottomEm(line) + 0.68;

/** ارتفاع کل بلوک مرکزی (em) */
const totalEmOf = (lines: CenterLineSpec[]): number =>
  lines.slice(0, -1).reduce((sum, line) => sum + stepEmOf(line), 0) +
  0.5 +
  symBottomEm(lines[lines.length - 1]);

/**
 * انتخاب هوشمند بلوک مرکزی بر اساس فضای قطعه:
 *  - جادار: نام + «طول: …» + «عرض: …» (با علائم عملیات زیر هر عدد)
 *  - متوسط: فقط «طول: …» و «عرض: …» با علائم
 *  - کوچک (یا زیر ۴۰mm): فقط «طول×عرض» فشرده، بدون علامت
 *  - خیلی ریز: شمارهٔ نمونه
 * علائم زیر «طول» از شمارنده‌های جهت طول قطعه و زیر «عرض» از جهت عرض
 * می‌آیند؛ مستقل از چرخش قطعه روی نقشه (متن مرکز خودش می‌چرخد).
 */
function buildCenterLines(
  placement: PlacedPartData,
  source: CutPart | undefined,
  name: string,
): CenterSpec | null {
  const { width: w, height: h, isRotated } = placement;
  // طول/عرض «خود قطعه» از جدول؛ بدون ردیف منبع، از روی جهت چیدمان
  const partLength = source?.length ?? (isRotated ? h : w);
  const partWidth = source?.width ?? (isRotated ? w : h);
  const compactLine = `${partLength}×${partWidth}`;

  const farsiSuffixOf = (count: number): string =>
    count > 0 ? ` ${Array.from({ length: count }, () => 'ف').join(' ')}` : '';
  const lenFarsiSuffix = farsiSuffixOf(source?.farsiLength ?? 0);
  const widFarsiSuffix = farsiSuffixOf(source?.farsiWidth ?? 0);

  const nameLine: CenterLineSpec = { text: name, band: 0, groove: 0 };
  const lengthLine: CenterLineSpec = {
    text: `طول: ${partLength}${lenFarsiSuffix}`,
    band: source?.bandLength ?? 0,
    groove: source?.grooveLength ?? 0,
    digitText: String(partLength),
    farsiSuffix: lenFarsiSuffix,
  };
  const widthLine: CenterLineSpec = {
    text: `عرض: ${partWidth}${widFarsiSuffix}`,
    band: source?.bandWidth ?? 0,
    groove: source?.grooveWidth ?? 0,
    digitText: String(partWidth),
    farsiSuffix: widFarsiSuffix,
  };

  const availAlong = (isRotated ? h : w) * 0.92; // در امتداد خط متن (mm نقشه)
  const availAcross = (isRotated ? w : h) * 0.92; // عمود بر خط متن (mm نقشه)
  const smallPart = Math.min(w, h) < SMALL_PART_MM;

  const fitFont = (lines: CenterLineSpec[], cap: number): number =>
    Math.min(
      cap,
      availAlong / (Math.max(...lines.map((l) => charCount(l.text))) * 0.62),
      availAcross / (totalEmOf(lines) * 1.12),
    );

  if (!smallPart) {
    const threeLines = [nameLine, lengthLine, widthLine];
    const three = fitFont(threeLines, CENTER_FONT_MAX_MM);
    if (three >= CENTER_FONT_MIN_MM) return { lines: threeLines, fontSize: three };

    const twoLines = [lengthLine, widthLine];
    const two = fitFont(twoLines, CENTER_FONT_MAX_MM);
    if (two >= CENTER_FONT_MIN_MM) return { lines: twoLines, fontSize: two };
    // ابعاد + علائم با فونت کوچک‌تر هنوز از حالت فشردهٔ بدون علامت بهتر است
    if (two >= DIMS_FONT_MIN_MM) return { lines: twoLines, fontSize: two };
  }

  // نوارهای باریک (مثلاً ۱۲۰۰×۳۰): فقط «طول×عرض» در امتداد طول قطعه
  const compactSpec: CenterLineSpec = { text: compactLine, band: 0, groove: 0 };
  const compact = Math.min(
    40,
    availAlong / (charCount(compactLine) * 0.62),
    availAcross / 1.35,
  );
  if (compact >= COMPACT_FONT_MIN_MM) return { lines: [compactSpec], fontSize: compact };

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

/** بدنهٔ قطعه + بلوک مرکزی (نام/طول/عرض و علائم عملیات زیر هر عدد) */
function PlacedPart({ placement, source, scale: s }: PlacedPartProps) {
  const { x, y, width: w, height: h, isRotated } = placement;
  const cx = x + w / 2;
  const cy = y + h / 2;

  const name = (placement.name ?? source?.name ?? '').trim() || 'بدون نام';
  const mapDims = `${placement.width}×${placement.height}`;

  const center = buildCenterLines(placement, source, name);

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
    // مرکز عمودی هر خط متن؛ خط‌های بعدی بعد از علائم خط قبلی می‌نشینند
    const centers: number[] = [];
    {
      let cursor = cy - (totalEmOf(lines) * fontSize) / 2 + fontSize * 0.5;
      for (const line of lines) {
        centers.push(cursor);
        cursor += stepEmOf(line) * fontSize;
      }
    }
    const symStroke = Math.max(0.9, fontSize * 0.105);

    return (
      <g transform={transform} pointerEvents="none">
        {lines.map((line, i) => {
          const yLine = centers[i];
          // مرکز «عدد» در متن راست‌به‌چپ: از سمت چپ بلوک = پسوند ف‌ها + نصف عدد
          const lineW = textWidth(line.text, fontSize);
          const digitsW = line.digitText ? textWidth(line.digitText, fontSize) : 0;
          const farsiW = line.farsiSuffix ? textWidth(line.farsiSuffix, fontSize) : 0;
          const ux = cx - lineW / 2 + farsiW + digitsW / 2;
          const uHalf = Math.max(digitsW * 0.62, fontSize * 0.55);

          // ردیف‌های علائم زیر عدد: اول نوار(های) ممتد، بعد شیارهای خط‌چین
          const rows: { y: number; dashed: boolean }[] = [];
          let off = SYM_FIRST_EM;
          for (let k = 0; k < line.band; k += 1) {
            rows.push({ y: yLine + off * fontSize, dashed: false });
            off += SYM_STEP_EM;
          }
          if (line.band > 0 && line.groove > 0) off += SYM_GROUP_GAP_EM;
          for (let k = 0; k < line.groove; k += 1) {
            rows.push({ y: yLine + off * fontSize, dashed: true });
            off += SYM_STEP_EM;
          }

          return (
            <g key={i}>
              <text
                x={cx}
                y={yLine}
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
                {line.text}
              </text>
              {rows.map((row, r) => (
                <line
                  key={r}
                  x1={ux - uHalf}
                  x2={ux + uHalf}
                  y1={row.y}
                  y2={row.y}
                  stroke={COLOR.text}
                  strokeWidth={symStroke}
                  strokeLinecap="round"
                  strokeDasharray={row.dashed ? `${fontSize * 0.3} ${fontSize * 0.2}` : undefined}
                />
              ))}
            </g>
          );
        })}
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

      {/* نام، ابعاد و علائم عملیات در مرکز قطعه */}
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

        {/* کادر راهنمای علائم — در پیش‌نمایش صفحه و سند چاپی (زیر هدر سند) هر دو دیده می‌شود */}
        <div className="map-legend-box rounded-lg border-2 border-slate-900 bg-white px-3 py-2">
          <span className="map-legend-title mb-1 block text-xs font-black text-slate-900">راهنمای علائم</span>
          <ul className="map-legend flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-700">
          <li className="flex items-center gap-1">
            <svg viewBox="0 0 26 8" className="h-2.5 w-7" aria-hidden="true">
              <line x1="2" y1="4" x2="24" y2="4" stroke="#000" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <span className="font-bold">نوار</span> (لبه‌چسب)
          </li>
          <li className="flex items-center gap-1">
            <svg viewBox="0 0 26 8" className="h-2.5 w-7" aria-hidden="true">
              <line x1="2" y1="4" x2="24" y2="4" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeDasharray="4.5 3" />
            </svg>
            <span className="font-bold">شیار</span>
          </li>
          <li className="flex items-center gap-1">
            <span className="text-sm font-black leading-none text-black">ف</span>
            <span className="font-bold">برش فارسی</span> (۴۵ درجه)
          </li>
          <li className="flex items-center gap-1">
            <svg viewBox="0 0 24 16" className="h-4 w-6" aria-hidden="true">
              <rect x="1" y="1" width="22" height="14" fill="#fff" stroke="#000" />
              <path d="M3 14 12 2 M11 14 20 2" stroke="#555" strokeWidth="1.5" />
            </svg>
            <span className="font-bold">هاشور ضایعات</span> / باقی‌ماندهٔ ورق
          </li>
          <li className="text-slate-500">
            علامت زیر «طول» برای لبه‌های طول و زیر «عرض» برای لبه‌های عرض است؛ دو خط (یا «ف ف») یعنی هر دو لبه
          </li>
          </ul>
        </div>

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
          («طول» و «عرض») درشت نوشته شده و عملیات لبه‌ها با علامت دقیقاً زیر همان عدد آمده است:
          خط ممتد = نوار، خط‌چین = شیار و حرف «ف» کنار عدد = فارسی ۴۵° (دو علامت یعنی هر دو لبه)؛
          روی هر قطعه مکث کنید تا جزئیاتش را ببینید.
        </p>
      )}
    </div>
  );
}
