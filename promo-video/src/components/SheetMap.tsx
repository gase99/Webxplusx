import React from 'react';
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT_FAMILY } from '../lib/font';
import { DEMO_PARTS, SHEET_H, SHEET_W, type DemoPart, type OpSide } from '../lib/layout';
import { COLORS } from '../lib/theme';

/**
 * نقشهٔ ورق به سبک خود نرم‌افزار:
 *  - حالت color: قطعات رنگی/روشن برای انیمیشن «محاسبهٔ چیدمان» (صحنهٔ ۳)
 *  - حالت bw: سیاه‌وسفید کارگاهی با هاشور پرت و پیکان عملیات لبه‌ها (صحنهٔ ۴)
 * قطعات به‌ترتیب، از فریم مشخص‌شده و با فاصلهٔ stagger «فرود» می‌آیند.
 */

const PAD = 46; // حاشیهٔ دور ورق برای پیکان‌ها و متن‌ها

const NORMAL: Record<OpSide, [number, number]> = {
  top: [0, -1],
  bottom: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};
const TANGENT: Record<OpSide, [number, number]> = {
  top: [1, 0],
  bottom: [1, 0],
  left: [0, 1],
  right: [0, 1],
};

/** جای لنگر پیکان روی هر لبه (مثل خود برنامه) تا برچسب لبه‌های روبه‌رو روی هم نیفتد */
const SIDE_ANCHOR: Record<OpSide, number> = {
  top: 0.32,
  bottom: 0.68,
  left: 0.34,
  right: 0.66,
};

/** پیکان مشکی بیرون لبه + نام عملیات (همان قراردادی که در نقشهٔ برنامه است) */
const ArrowMarker: React.FC<{ part: DemoPart; side: OpSide; label: string; bw: boolean }> = ({
  part,
  side,
  label,
  bw,
}) => {
  const horizontal = side === 'top' || side === 'bottom';
  const [nx, ny] = NORMAL[side];
  const [tx, ty] = TANGENT[side];
  const edgeLen = horizontal ? part.w : part.h;
  const along = edgeLen * SIDE_ANCHOR[side];
  const ax = horizontal ? part.x + along : side === 'left' ? part.x : part.x + part.w;
  const ay = horizontal ? (side === 'top' ? part.y : part.y + part.h) : part.y + along;
  const at = (out: number, lat = 0): [number, number] => [ax + nx * out + tx * lat, ay + ny * out + ty * lat];

  const gap = 4;
  const len = 17;
  const head = 8.5;
  const halfShaft = 2.6;
  const halfHead = 7;
  const points = [
    at(gap, 0),
    at(gap + head, -halfHead),
    at(gap + head, -halfShaft),
    at(gap + len, -halfShaft),
    at(gap + len, halfShaft),
    at(gap + head, halfShaft),
    at(gap + head, halfHead),
  ]
    .map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`)
    .join(' ');

  const [textX, textY] = at(gap + len + 13);
  const ink = bw ? '#000000' : COLORS.ink;

  return (
    <g>
      <polygon points={points} fill={ink} stroke="#ffffff" strokeWidth={1.6} strokeLinejoin="round" />
      <text
        x={textX}
        y={textY}
        transform={horizontal ? undefined : `rotate(-90 ${textX} ${textY})`}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={19}
        fontWeight={800}
        fill={ink}
        stroke="#ffffff"
        strokeWidth={3.4}
        strokeLinejoin="round"
        paintOrder="stroke"
        style={{ fontFamily: FONT_FAMILY, direction: 'rtl' }}
      >
        {label}
      </text>
    </g>
  );
};

interface SheetMapProps {
  mode: 'color' | 'bw';
  /** فریم شروع فرود قطعهٔ اول (نسبت به شروع صحنه) */
  startFrame?: number;
  /** فاصلهٔ فریم بین فرود قطعات */
  stagger?: number;
  showArrows?: boolean;
  /** فریم شروع ظاهرشدن پیکان‌ها */
  arrowStartFrame?: number;
  /** شمارهٔ قطعه‌ای که با حلقهٔ سبز برجسته شود (صحنهٔ ۴) */
  highlightIndex?: number;
  highlightFromFrame?: number;
}

export const SheetMap: React.FC<SheetMapProps> = ({
  mode,
  startFrame = 0,
  stagger = 13,
  showArrows = false,
  arrowStartFrame = 0,
  highlightIndex = -1,
  highlightFromFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bw = mode === 'bw';
  const ink = bw ? '#000000' : COLORS.ink;

  const arrowOpacity = showArrows
    ? interpolate(frame, [arrowStartFrame, arrowStartFrame + 16], [0, 1], {
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
        const big = part.w >= 190 && part.h >= 72;

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
            {big && (
              <>
                <text
                  x={cx}
                  y={cy - 13}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={23}
                  fontWeight={800}
                  fill={ink}
                  style={{ fontFamily: FONT_FAMILY }}
                >
                  {part.name}
                </text>
                <text
                  x={cx}
                  y={cy + 15}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={19}
                  fontWeight={600}
                  fill={ink}
                  style={{ fontFamily: FONT_FAMILY, direction: 'ltr' }}
                >
                  {part.dims}
                </text>
              </>
            )}
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

      {/* پیکان‌های عملیات روی همهٔ قطعات (بالای بدنه‌ها) */}
      {showArrows && (
        <g opacity={arrowOpacity}>
          {DEMO_PARTS.flatMap((part, i) =>
            part.ops.map((op) => (
              <ArrowMarker key={`${i}-${op.side}-${op.label}`} part={part} side={op.side} label={op.label} bw={bw} />
            )),
          )}
        </g>
      )}

      {/* کادر نهایی ورق بالای همه‌چیز */}
      <rect x={0} y={0} width={SHEET_W} height={SHEET_H} fill="none" stroke={ink} strokeWidth={3.2} />
    </svg>
  );
};
