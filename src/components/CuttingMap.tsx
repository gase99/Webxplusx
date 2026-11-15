import { useId, useMemo, useState, type ReactNode } from 'react';
import type {
  PlacedPart as PlacedPartData,
  SheetLayout,
  StockSheet,
} from '../algorithm';
import { getPartEdgeSides, type PartSide } from '../partEdges';
import type { CutPart } from '../types/part';

/**
 * A-Cut 2Dpro — فاز ۳: نقشهٔ برش (Cutting Map)
 * ============================================
 * خروجی موتور فاز ۲ (sheets / placements) را با SVG رسم می‌کند.
 * واحد دستگاه مختصات خودِ میلی‌متر است (viewBox برابر ابعاد صفحهٔ خام)،
 * پس نقشه در هر اندازه‌ای بدون افت کیفیت و با حفظ نسبت ابعاد نمایش داده می‌شود.
 *
 * قرارداد خواندن نقشه (سیاه‌وسفید — علامت روی «خودِ لبه»):
 *  - بدنهٔ قطعه سفید با حاشیهٔ مشکی؛ پرت/باقی‌ماندهٔ ورق: هاشور مورب نازک.
 *  - مرکز قطعه: فقط نام قطعه. اندازه‌ها کنار ضلع مربوطه نوشته می‌شوند: عدد بالای
 *    قطعه = اندازهٔ ضلع افقی و عدد سمت راست (عمودی) = اندازهٔ ضلع عمودی روی نقشه.
 *  - عملیات هر لبه دقیقاً روی همان لبه (نگاشت مشترک `partEdges.ts`، هم‌سو با
 *    لیبل و DXF) رسم می‌شود:
 *      نوار  ← نوار مشکی توپر چسبیده به لبه
 *      شیار  ← کانال دو خطی (با خط‌چین وسط) موازی لبه، کمی داخل‌تر از آن
 *      فارسی ← خط دندانه‌ای (زیگزاگ ۴۵°) موازی لبه
 *    نزدیک ابتدای هر لبهٔ علامت‌دار یک برچسب گرد با حرف اختصاری عملیات
 *    (ن / ش / ف) هم می‌آید تا بدون راهنما هم خوانا باشد.
 *  - در قطعات خیلی کوچک برچسب‌های حرفی حذف می‌شوند ولی خود علائم لبه می‌مانند.
 */

const faNumber = new Intl.NumberFormat('fa-IR');
const faDecimal = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });

const INK = '#000000';
const PAPER = '#ffffff';

const FONT_FAMILY = 'Vazirmatn, Tahoma, Arial, sans-serif';
const charCount = (str: string): number => [...str].length;

/* ------------------------------------------------------------------ */
/*  هندسهٔ علائم لبه                                                   */
/* ------------------------------------------------------------------ */

type EdgeOp = 'band' | 'groove' | 'farsi';

/** حرف اختصاری هر عملیات روی برچسب گرد کنار لبه */
const OP_LETTER: Record<EdgeOp, string> = { band: 'ن', groove: 'ش', farsi: 'ف' };

interface EdgeFrame {
  /** نقطهٔ شروع لبه */
  x0: number;
  y0: number;
  /** بردار یکهٔ امتداد لبه */
  ax: number;
  ay: number;
  /** بردار یکهٔ عمود رو به داخل قطعه */
  nx: number;
  ny: number;
  /** طول لبه */
  len: number;
}

function edgeFrame(side: PartSide, x: number, y: number, w: number, h: number): EdgeFrame {
  switch (side) {
    case 'top':
      return { x0: x, y0: y, ax: 1, ay: 0, nx: 0, ny: 1, len: w };
    case 'bottom':
      return { x0: x, y0: y + h, ax: 1, ay: 0, nx: 0, ny: -1, len: w };
    case 'left':
      return { x0: x, y0: y, ax: 0, ay: 1, nx: 1, ny: 0, len: h };
    case 'right':
    default:
      return { x0: x + w, y0: y, ax: 0, ay: 1, nx: -1, ny: 0, len: h };
  }
}

/** نقطه‌ای با فاصلهٔ `t` در امتداد لبه و `d` به داخل قطعه */
const at = (f: EdgeFrame, t: number, d: number): [number, number] => [
  f.x0 + f.ax * t + f.nx * d,
  f.y0 + f.ay * t + f.ny * d,
];

/** مستطیل هم‌راستا با محور بین فاصله‌های [d0, d1] از لبه و [t0, t1] در امتداد آن */
function bandRect(f: EdgeFrame, t0: number, t1: number, d0: number, d1: number) {
  const [ax, ay] = at(f, t0, d0);
  const [bx, by] = at(f, t1, d1);
  return {
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    width: Math.abs(bx - ax),
    height: Math.abs(by - ay),
  };
}

interface EdgeLayout {
  side: PartSide;
  ops: EdgeOp[];
}

/** گروه‌بندی عملیات هر لبه: یک لبه می‌تواند هم‌زمان نوار، شیار و فارسی داشته باشد */
function edgeLayouts(source: CutPart | undefined, isRotated: boolean): EdgeLayout[] {
  if (!source) return [];
  const sides = getPartEdgeSides(source, isRotated);
  const order: PartSide[] = ['top', 'right', 'bottom', 'left'];
  return order
    .map((side) => ({
      side,
      ops: (['band', 'farsi', 'groove'] as EdgeOp[]).filter((op) => sides[op].includes(side)),
    }))
    .filter((e) => e.ops.length > 0);
}

interface MarkMetrics {
  /** واحد پایهٔ ضخامت علائم (mm نقشه) */
  u: number;
  stroke: number;
  /** عمق هر عملیات از لبه: [شروع، پایان] */
  zone: (ops: EdgeOp[], op: EdgeOp) => [number, number];
  /** عمق کل علائم یک لبه */
  depth: (ops: EdgeOp[]) => number;
  /** شعاع برچسب گرد حرفی (۰ یعنی برچسب رسم نشود) */
  tagR: number;
}

function markMetrics(w: number, h: number, s: number): MarkMetrics {
  const minDim = Math.min(w, h);
  // سقف minDim*0.08: حتی با سه عملیات روی دو لبهٔ روبه‌رو، علائم به هم نمی‌رسند (عمق کل = ۵u)
  const u = Math.min(Math.max(Math.min(6 * s, minDim * 0.075), 0.6 * s), minDim * 0.08);
  const gap = u * 0.6;
  const size: Record<EdgeOp, number> = { band: u, farsi: u * 1.1, groove: u * 1.7 };
  const zone = (ops: EdgeOp[], op: EdgeOp): [number, number] => {
    let d = 0;
    for (const o of ops) {
      if (o !== 'band' || d > 0) d += gap;
      if (o === op) return [d, d + size[o]];
      d += size[o];
    }
    return [0, 0];
  };
  const depth = (ops: EdgeOp[]): number => (ops.length ? zone(ops, ops[ops.length - 1])[1] : 0);
  const tagR = Math.min(u * 1.35, 20 * s);
  return {
    u,
    stroke: Math.max(0.5 * s, u * 0.16),
    zone,
    depth,
    tagR: minDim >= 7 * tagR ? tagR : 0,
  };
}

function EdgeMarks({
  edge,
  frame,
  m,
}: {
  edge: EdgeLayout;
  frame: EdgeFrame;
  m: MarkMetrics;
}) {
  const { ops } = edge;
  const f = frame;
  const inset = m.u * 0.4;
  return (
    <g pointerEvents="none">
      {ops.map((op) => {
        const [d0, d1] = m.zone(ops, op);
        if (op === 'band') {
          return <rect key={op} {...bandRect(f, 0, f.len, d0, d1)} fill={INK} />;
        }
        if (op === 'groove') {
          const r = bandRect(f, inset, f.len - inset, d0, d1);
          const [cx0, cy0] = at(f, inset, (d0 + d1) / 2);
          const [cx1, cy1] = at(f, f.len - inset, (d0 + d1) / 2);
          return (
            <g key={op}>
              <rect {...r} fill={PAPER} stroke={INK} strokeWidth={m.stroke * 1.3} />
              <line
                x1={cx0}
                y1={cy0}
                x2={cx1}
                y2={cy1}
                stroke={INK}
                strokeWidth={m.stroke * 1.6}
                strokeDasharray={`${m.u * 1.1} ${m.u * 0.7}`}
              />
            </g>
          );
        }
        // فارسی: زیگزاگ با زاویهٔ ۴۵° بین دو عمق
        const amp = d1 - d0;
        const step = amp * 2;
        const t0 = inset;
        const t1 = f.len - inset;
        const count = Math.max(2, Math.floor((t1 - t0) / step));
        const realStep = (t1 - t0) / count;
        const pts: string[] = [];
        for (let i = 0; i <= count * 2; i += 1) {
          const t = t0 + (realStep / 2) * i;
          const [px, py] = at(f, t, i % 2 === 0 ? d1 : d0);
          pts.push(`${px},${py}`);
        }
        return (
          <polyline
            key={op}
            points={pts.join(' ')}
            fill="none"
            stroke={INK}
            strokeWidth={m.stroke * 1.2}
            strokeLinejoin="miter"
          />
        );
      })}
    </g>
  );
}

interface TagLayout {
  cx: number;
  cy: number;
  halfW: number;
}

/**
 * جای برچسب حرفی یک لبه: نزدیک ابتدای لبه (نه وسط، چون وسط لبه جای عدد اندازه است).
 * برچسب کپسولی همیشه افقی است، پس روی لبه‌های چپ/راست پهنای آن در راستای عمق قرار
 * می‌گیرد. اگر کامل داخل قطعه و بیرون از محدودهٔ عدد اندازه جا نشود null برمی‌گردد.
 */
function tagLayout(
  edge: EdgeLayout,
  frame: EdgeFrame,
  m: MarkMetrics,
  w: number,
  h: number,
  /** فاصلهٔ لازم از گوشه (عمق علائم لبه‌های عمود) */
  cornerClear: number,
  /** بیشینهٔ فاصلهٔ مجاز انتهای برچسب از ابتدای لبه */
  alongLimit: number,
): TagLayout | null {
  const r = m.tagR;
  if (r <= 0) return null;
  // برای چند عملیات روی یک لبه، برچسب کشیده (کپسولی) می‌شود
  const halfW = r + (edge.ops.length - 1) * r * 0.85;
  const vertical = frame.nx !== 0;
  const halfAcross = vertical ? halfW : r;
  const halfAlong = vertical ? r : halfW;
  const depth = Math.max(halfAcross * 1.1, m.depth(edge.ops) / 2);
  const across = vertical ? w : h;
  if (depth + halfAcross > across / 2) return null;
  const t = Math.max(frame.len * 0.18, cornerClear + halfAlong + m.u * 0.5);
  if (t + halfAlong > alongLimit) return null;
  const [cx, cy] = at(frame, t, depth);
  return { cx, cy, halfW };
}

function EdgeTag({ edge, tag, m }: { edge: EdgeLayout; tag: TagLayout; m: MarkMetrics }) {
  const r = m.tagR;
  const letters = edge.ops.map((op) => OP_LETTER[op]);
  const { cx, cy, halfW } = tag;
  const fontSize = r * 1.25;
  return (
    <g pointerEvents="none">
      <rect
        x={cx - halfW}
        y={cy - r}
        width={halfW * 2}
        height={r * 2}
        rx={r}
        fill={PAPER}
        stroke={INK}
        strokeWidth={Math.max(m.stroke, r * 0.12)}
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight="900"
        fill={INK}
        style={{ fontFamily: FONT_FAMILY, direction: 'rtl' }}
      >
        {letters.join(' ')}
      </text>
    </g>
  );
}

/* ------------------------------------------------------------------ */
/*  متن مرکز قطعه                                                       */
/* ------------------------------------------------------------------ */

const NAME_FONT_MAX_MM = 50;
const NAME_FONT_MIN_MM = 7;
const DIM_FONT_MAX_MM = 42;
const DIM_FONT_MIN_MM = 6;

/** اندازهٔ فونت نام وسط قطعه؛ جهت متن (افقی/عمودی) هر کدام جای بیشتری بدهد */
function fitName(name: string, availW: number, availH: number): { size: number; vertical: boolean } {
  const n = Math.max(charCount(name), 1);
  const fit = (along: number, across: number) =>
    along <= 0 || across <= 0 ? 0 : Math.min(NAME_FONT_MAX_MM, (along * 0.9) / (n * 0.6), across * 0.8);
  const horizontal = fit(availW, availH);
  const vertical = fit(availH, availW);
  return vertical > horizontal * 1.15 ? { size: vertical, vertical: true } : { size: horizontal, vertical: false };
}

interface DimLabel {
  side: PartSide;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  rotate: boolean;
  /** نیم‌طول متن در امتداد لبه */
  half: number;
  /** فاصلهٔ لبهٔ داخلی متن از لبهٔ قطعه */
  reach: number;
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

  const name = (placement.name ?? source?.name ?? '').trim() || 'بدون نام';
  const mapDims = `${placement.width}×${placement.height}`;
  const partLength = source?.length ?? (isRotated ? h : w);
  const partWidth = source?.width ?? (isRotated ? w : h);

  const edges = edgeLayouts(source, isRotated);
  const m = markMetrics(w, h, s);
  const markDepth = (side: PartSide): number => {
    const e = edges.find((edge) => edge.side === side);
    return e ? m.depth(e.ops) : 0;
  };

  // عدد اندازه کنار ضلع مربوطه: بالا = بُعد افقی روی نقشه، راست = بُعد عمودی
  const dimFont = Math.min(DIM_FONT_MAX_MM, Math.max(Math.min(w, h) * 0.16, 2.5 * s));
  const dimLabel = (side: 'top' | 'right', value: number): DimLabel | null => {
    const text = String(value);
    const frame = edgeFrame(side, x, y, w, h);
    const across = side === 'top' ? h : w;
    const clear = Math.max(markDepth(side === 'top' ? 'left' : 'top'), markDepth(side === 'top' ? 'right' : 'bottom'));
    const room = frame.len - 2 * clear;
    const font = Math.min(dimFont, (room * 0.8) / (charCount(text) * 0.6));
    if (font < DIM_FONT_MIN_MM) return null;
    const depth = markDepth(side) + m.u * 0.6 + font * 0.55;
    if (depth + font * 0.55 > across / 2) return null;
    const [lx, ly] = at(frame, frame.len / 2, depth);
    return {
      side,
      text,
      x: lx,
      y: ly,
      fontSize: font,
      rotate: side === 'right',
      half: (charCount(text) * 0.6 * font) / 2,
      reach: depth + font * 0.55,
    };
  };
  const dims = [
    dimLabel('top', isRotated ? partWidth : partLength),
    dimLabel('right', isRotated ? partLength : partWidth),
  ].filter((d): d is DimLabel => d !== null);

  const marked = edges.map((edge) => {
    const frame = edgeFrame(edge.side, x, y, w, h);
    const vertical = edge.side === 'left' || edge.side === 'right';
    const cornerClear = vertical
      ? Math.max(markDepth('top'), markDepth('bottom'))
      : Math.max(markDepth('left'), markDepth('right'));
    const dim = dims.find((d) => d.side === edge.side);
    const alongLimit = dim ? frame.len / 2 - dim.half - m.u : frame.len - cornerClear - m.u * 0.5;
    return { edge, frame, tag: tagLayout(edge, frame, m, w, h, cornerClear, alongLimit) };
  });

  // فضای آزاد وسط برای نام: منهای عمق علائم، برچسب‌ها و اعداد اندازه
  const reachOf = (side: PartSide): number => {
    const e = marked.find((item) => item.edge.side === side);
    const tagReach = e?.tag
      ? side === 'left' || side === 'right'
        ? Math.abs(e.tag.cx - (side === 'left' ? x : x + w)) + e.tag.halfW
        : Math.abs(e.tag.cy - (side === 'top' ? y : y + h)) + m.tagR
      : 0;
    const dimReach = dims.find((d) => d.side === side)?.reach ?? 0;
    return Math.max(markDepth(side), tagReach, dimReach);
  };
  const gapIn = m.u * 0.6;
  const innerX0 = x + reachOf('left') + gapIn;
  const innerX1 = x + w - reachOf('right') - gapIn;
  const innerY0 = y + reachOf('top') + gapIn;
  const innerY1 = y + h - reachOf('bottom') - gapIn;
  const nameFit = fitName(name, innerX1 - innerX0, innerY1 - innerY0);
  const nameX = (innerX0 + innerX1) / 2;
  const nameY = (innerY0 + innerY1) / 2;

  const renderCenter = () => {
    if (nameFit.size >= NAME_FONT_MIN_MM) {
      return (
        <text
          x={nameX}
          y={nameY}
          transform={nameFit.vertical ? `rotate(-90 ${nameX} ${nameY})` : undefined}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={nameFit.size}
          fontWeight="900"
          fill={INK}
          pointerEvents="none"
          style={{ fontFamily: FONT_FAMILY, direction: 'rtl' }}
        >
          {name}
        </text>
      );
    }
    if (Math.min(w, h) >= 14 && dims.length === 0) {
      return (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={Math.min(30, Math.min(w, h) / 1.6)}
          fontWeight="800"
          fill={INK}
          pointerEvents="none"
          style={{ fontFamily: FONT_FAMILY }}
        >
          {placement.instanceIndex}
        </text>
      );
    }
    return null;
  };

  const renderDims = () =>
    dims.map((d) => (
      <text
        key={d.side}
        x={d.x}
        y={d.y}
        transform={d.rotate ? `rotate(-90 ${d.x} ${d.y})` : undefined}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={d.fontSize}
        fontWeight="800"
        fill={INK}
        pointerEvents="none"
        style={{ fontFamily: FONT_FAMILY }}
      >
        {d.text}
      </text>
    ));

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

      <rect x={x} y={y} width={w} height={h} fill={PAPER} stroke={INK} strokeWidth={1.8 * s} />

      {marked.map(({ edge, frame }) => (
        <EdgeMarks key={edge.side} edge={edge} frame={frame} m={m} />
      ))}

      {/* خط دور دوباره روی علائم تا مرز قطعه همیشه واضح بماند */}
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={INK} strokeWidth={1.8 * s} />

      {marked.map(({ edge, tag }) =>
        tag ? <EdgeTag key={edge.side} edge={edge} tag={tag} m={m} /> : null,
      )}

      {renderDims()}
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
          نقشهٔ برش
          <span className="ms-2 text-xs font-medium text-slate-400" dir="ltr">
            Cutting Map (SVG)
          </span>
        </h3>

        {/* کادر راهنمای علائم — در پیش‌نمایش صفحه و سند چاپی (زیر هدر سند) هر دو دیده می‌شود */}
        <div className="map-legend-box rounded-lg border-2 border-black bg-white px-3 py-2">
          <span className="map-legend-title mb-1 block text-xs font-black text-black">راهنمای علائم لبه</span>
          <ul className="map-legend flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-black">
            <li className="flex items-center gap-1.5">
              <LegendSwatch>
                <rect x="1" y="1" width="30" height="5" fill="#000" />
              </LegendSwatch>
              <TagChip letter="ن" />
              <span className="font-bold">نوار</span> (لبه‌چسب)
            </li>
            <li className="flex items-center gap-1.5">
              <LegendSwatch>
                <rect x="2" y="7" width="28" height="6" fill="#fff" stroke="#000" strokeWidth="1" />
                <line x1="2" y1="10" x2="30" y2="10" stroke="#000" strokeWidth="1" strokeDasharray="3 2" />
              </LegendSwatch>
              <TagChip letter="ش" />
              <span className="font-bold">شیار</span> (جای ورق پشت‌بند)
            </li>
            <li className="flex items-center gap-1.5">
              <LegendSwatch>
                <polyline points="2,8 5,3 8,8 11,3 14,8 17,3 20,8 23,3 26,8 29,3" fill="none" stroke="#000" strokeWidth="1.3" />
              </LegendSwatch>
              <TagChip letter="ف" />
              <span className="font-bold">فارسی</span> (برش ۴۵°)
            </li>
            <li className="flex items-center gap-1.5">
              <svg viewBox="0 0 32 16" className="h-4 w-8" aria-hidden="true">
                <defs>
                  <pattern id={`${patternId}-lg`} patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="4" stroke="#000" strokeWidth="0.8" />
                  </pattern>
                </defs>
                <rect x="1" y="1" width="30" height="14" fill={`url(#${patternId}-lg)`} stroke="#000" />
              </svg>
              <span className="font-bold">ضایعات</span> / باقی‌ماندهٔ ورق
            </li>
            <li className="w-full text-[10px] font-medium text-black">
              هر علامت دقیقاً روی همان لبه‌ای از قطعه کشیده شده که عملیات دارد؛ حرف داخل برچسب گرد کنار لبه نوع عملیات را می‌گوید.
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
                    {/* هاشور ضایعات: خطوط مورب نازک مشکی */}
                    <pattern
                      id={`${patternId}-waste`}
                      patternUnits="userSpaceOnUse"
                      width={16 * scale}
                      height={16 * scale}
                      patternTransform="rotate(45)"
                    >
                      <rect width={16 * scale} height={16 * scale} fill={PAPER} />
                      <line x1={0} y1={0} x2={0} y2={16 * scale} stroke={INK} strokeWidth={1.2 * scale} />
                    </pattern>
                  </defs>

                  {/* بدنهٔ ورق خام: پس‌زمینه‌اش همان پرت/باقی‌مانده است */}
                  <rect x={0} y={0} width={stock.length} height={stock.width} fill={`url(#${patternId}-waste)`} stroke={INK} strokeWidth={2.4 * scale} />

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
          فاصله‌های باریک بین قطعات همان خوراک تیغه (Kerf) است. وسط هر قطعه نامش و کنار
          هر ضلع اندازهٔ همان ضلع نوشته شده و عملیات هر لبه روی خودِ همان لبه علامت خورده است:
          نوار مشکی توپر = نوار، کانال دو خطی = شیار و خط دندانه‌ای = فارسی ۴۵°
          (حرف «ن / ش / ف» در برچسب گرد کنار لبه)؛ روی هر قطعه مکث کنید تا جزئیاتش را ببینید.
        </p>
      )}
    </div>
  );
}

function LegendSwatch({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 32 16" className="h-4 w-8" aria-hidden="true">
      <rect x="0.5" y="0.5" width="31" height="15" fill="#fff" stroke="#000" strokeWidth="1" />
      {children}
    </svg>
  );
}

function TagChip({ letter }: { letter: string }) {
  return (
    <span className="map-legend-chip inline-flex h-4 w-4 items-center justify-center rounded-full border-[1.5px] border-black text-[10px] font-black leading-none">
      {letter}
    </span>
  );
}
