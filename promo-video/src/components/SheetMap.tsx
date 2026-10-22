import React from 'react';
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT_FAMILY } from '../lib/font';
import { DEMO_PARTS, SHEET_H, SHEET_W, type DemoPart, type OpSide } from '../lib/layout';
import { COLORS } from '../lib/theme';

/**
 * نقشهٔ ورق به سبک خود نرم‌افزار:
 *  - حالت color: قطعات رنگی/روشن برای انیمیشن «محاسبهٔ چیدمان» (صحنهٔ ۳)
 *  - حالت bw: سیاه‌وسفید کارگاهی با هاشور پرت و برچسب‌های درشت «داخل» قطعه‌ها
 *    (صحنهٔ ۴) — دقیقاً مثل نقشهٔ فعلی برنامه: نام + «طول/عرض» در مرکز و
 *    نام عملیات هر لبه موازی با همان لبه و با چیدمان پلکانی در صورت چند عملیات.
 * قطعات به‌ترتیب، از فریم مشخص‌شده و با فاصلهٔ stagger «فرود» می‌آیند.
 */

const PAD = 10; // دیگر متنی بیرون ورق نیست؛ حاشیه فقط برای قاب سفید

/** بردار «به داخل» قطعه برای هر لبه و بردار در امتداد لبه */
const INWARD: Record<OpSide, [number, number]> = {
  top: [0, 1],
  bottom: [0, -1],
  left: [1, 0],
  right: [-1, 0],
};
const TANGENT: Record<OpSide, [number, number]> = {
  top: [1, 0],
  bottom: [1, 0],
  left: [0, 1],
  right: [0, 1],
};

interface InsideLabelSpec {
  label: string;
  textX: number;
  textY: number;
  rotate: boolean;
  fontSize: number;
}

/** برچسب‌های عملیات «داخل» قطعه؛ موازی با لبه و در چند عملیات به‌صورت پلکانی */
const insideOpLabels = (part: DemoPart): InsideLabelSpec[] => {
  const sides: OpSide[] = ['top', 'bottom', 'left', 'right'];
  const specs: InsideLabelSpec[] = [];

  for (const side of sides) {
    const ops = part.ops.filter((op) => op.side === side);
    if (ops.length === 0) continue;
    const horizontal = side === 'top' || side === 'bottom';
    const edgeLen = horizontal ? part.w : part.h;
    const [ix, iy] = INWARD[side];
    const [tx, ty] = TANGENT[side];
    const sx = horizontal ? part.x : side === 'left' ? part.x : part.x + part.w;
    const sy = horizontal ? (side === 'top' ? part.y : part.y + part.h) : part.y;

    ops.forEach((op, index) => {
      const fontSize = 20;
      const inward = fontSize * 0.8 + index * fontSize * 1.35;
      const textW = op.label.length * fontSize * 0.62;
      const along =
        op.label === 'فارسی ۴۵°'
          ? Math.min(edgeLen / 2, textW / 2 + fontSize * 0.6)
          : edgeLen / 2;
      specs.push({
        label: op.label,
        textX: sx + tx * along + ix * inward,
        textY: sy + ty * along + iy * inward,
        rotate: !horizontal,
        fontSize,
      });
    });
  }
  return specs;
};

interface SheetMapProps {
  mode: 'color' | 'bw';
  /** فریم شروع فرود قطعهٔ اول (نسبت به شروع صحنه) */
  startFrame?: number;
  /** فاصلهٔ فریم بین فرود قطعات */
  stagger?: number;
  /** نمایش نام عملیات لبه‌ها داخل قطعات (صحنهٔ ۴) */
  showOps?: boolean;
  /** فریم شروع ظاهرشدن برچسب‌های عملیات */
  opsStartFrame?: number;
  /** شمارهٔ قطعه‌ای که با حلقهٔ سبز برجسته شود (صحنهٔ ۴) */
  highlightIndex?: number;
  highlightFromFrame?: number;
}

export const SheetMap: React.FC<SheetMapProps> = ({
  mode,
  startFrame = 0,
  stagger = 13,
  showOps = false,
  opsStartFrame = 0,
  highlightIndex = -1,
  highlightFromFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bw = mode === 'bw';
  const ink = bw ? '#000000' : COLORS.ink;

  const opsOpacity = showOps
    ? interpolate(frame, [opsStartFrame, opsStartFrame + 16], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      })
    : 0;

  const highlightOpacity = interpolate(frame, [highlightFromFrame, highlightFromFrame + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <svg
      viewBox={`${-PAD} ${-PAD} ${SHEET_W + PAD * 2} ${SHEET_H + PAD * 2}`}
      style={{ width: '100%', height: '100%', display: 'block' }}
      role="img"
      aria-label="نقشهٔ برش نمونه"
    >
      <defs>
        {/* هاشور پرت (ضایعات) — دو لایه مثل نقشهٔ واقعی برنامه */}
        <pattern id="promo-waste" patternUnits="userSpaceOnUse" width={26} height={26} patternTransform="rotate(45)">
          <rect width={26} height={26} fill={bw ? '#ffffff' : '#e2e8f0'} />
          <line x1={0} y1={0} x2={0} y2={26} stroke={bw ? '#666666' : '#94a3b8'} strokeWidth={6} />
        </pattern>
        <pattern id="promo-waste2" patternUnits="userSpaceOnUse" width={30} height={30} patternTransform="rotate(-45)">
          <rect width={30} height={30} fill="transparent" />
          <line x1={0} y1={0} x2={0} y2={30} stroke={bw ? '#000000' : '#64748b'} strokeWidth={2.4} strokeDasharray="4 5" opacity={0.55} />
        </pattern>
      </defs>

      {/* کاغذ سفید زیر نقشه برای حالت سیاه‌وسفید */}
      <rect x={-PAD} y={-PAD} width={SHEET_W + PAD * 2} height={SHEET_H + PAD * 2} fill="#ffffff" rx={10} />

      {/* بدنهٔ ورق = ناحیهٔ پرت؛ قطعات روی آن می‌نشینند */}
      <rect x={0} y={0} width={SHEET_W} height={SHEET_H} fill="url(#promo-waste)" stroke={ink} strokeWidth={3.2} />
      <rect x={0} y={0} width={SHEET_W} height={SHEET_H} fill="url(#promo-waste2)" opacity={0.9} />

      {DEMO_PARTS.map((part, i) => {
        const local = frame - (startFrame + i * stagger);
        const p = spring({ frame: local, fps, config: { damping: 90, stiffness: 120, mass: 0.9 } });
        const opacity = interpolate(local, [0, 9], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const lift = (1 - p) * -46;
        const scale = 0.92 + p * 0.08;
        const cx = part.x + part.w / 2;
        const cy = part.y + part.h / 2;
        const [dimL, dimW] = part.dims.split('×');

        // متن مرکز مثل خود برنامه: قطعهٔ جادار = نام + «طول: …» + «عرض: …»؛
        // قطعهٔ کم‌ارتفاع = فقط ابعاد فشرده («380×120»)
        const centerLines: { text: string; size: number; ltr?: boolean }[] =
          part.w >= 190 && part.h >= 125
            ? [
                { text: part.name, size: 23 },
                { text: `طول: ${dimL}`, size: 21 },
                { text: `عرض: ${dimW}`, size: 21 },
              ]
            : part.w >= 190 && part.h >= 66
              ? [{ text: part.dims, size: 19, ltr: true }]
              : [];
        // در حالت رنگی (صحنهٔ ۳) نام + ابعاد فشرده خواناتر است
        const lines = bw
          ? centerLines
          : part.w >= 190 && part.h >= 72
            ? [
                { text: part.name, size: 23 },
                { text: part.dims, size: 19, ltr: true },
              ]
            : [];
        const lineStep = 27;

        return (
          <g
            key={i}
            opacity={opacity}
            transform={`translate(${cx} ${cy + lift}) scale(${scale}) translate(${-cx} ${-cy})`}
          >
            <rect
              x={part.x}
              y={part.y}
              width={part.w}
              height={part.h}
              fill={bw ? '#ffffff' : i % 2 === 0 ? '#f0f9ff' : '#ecfdf5'}
              stroke={bw ? '#000000' : i % 2 === 0 ? COLORS.sky : COLORS.emerald}
              strokeWidth={bw ? 2.6 : 2.4}
            />
            {lines.map((line, li) => (
              <text
                key={li}
                x={cx}
                y={cy + (li - (lines.length - 1) / 2) * lineStep}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={line.size}
                fontWeight={800}
                fill={ink}
                stroke="#ffffff"
                strokeWidth={line.size * 0.14}
                strokeLinejoin="round"
                paintOrder="stroke"
                style={{ fontFamily: FONT_FAMILY, direction: line.ltr ? 'ltr' : 'rtl' }}
              >
                {line.text}
              </text>
            ))}
            {/* نام عملیات لبه‌ها داخل خود قطعه (همراه بدنه می‌نشیند) */}
            {showOps &&
              insideOpLabels(part).map((spec) => (
                <text
                  key={`${spec.label}-${spec.textX}-${spec.textY}`}
                  x={spec.textX}
                  y={spec.textY}
                  transform={spec.rotate ? `rotate(-90 ${spec.textX} ${spec.textY})` : undefined}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={spec.fontSize}
                  fontWeight={800}
                  fill={ink}
                  stroke="#ffffff"
                  strokeWidth={3.4}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                  opacity={opsOpacity}
                  style={{ fontFamily: FONT_FAMILY, direction: 'rtl' }}
                >
                  {spec.label}
                </text>
              ))}
            {i === highlightIndex && (
              <rect
                x={part.x - 6}
                y={part.y - 6}
                width={part.w + 12}
                height={part.h + 12}
                fill="none"
                stroke={COLORS.emerald}
                strokeWidth={5}
                strokeDasharray="16 8"
                opacity={highlightOpacity}
                rx={6}
              />
            )}
          </g>
        );
      })}

      {/* کادر نهایی ورق بالای همه‌چیز */}
      <rect x={0} y={0} width={SHEET_W} height={SHEET_H} fill="none" stroke={ink} strokeWidth={3.2} />
    </svg>
  );
};
