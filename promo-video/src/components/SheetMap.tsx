import React from 'react';
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT_FAMILY } from '../lib/font';
import { DEMO_PARTS, SHEET_H, SHEET_W, type DemoPart, type OpLabel, type OpSide } from '../lib/layout';
import { COLORS } from '../lib/theme';

/**
 * نقشهٔ ورق به سبک خود نرم‌افزار:
 *  - حالت color: قطعات رنگی/روشن برای انیمیشن «محاسبهٔ چیدمان» (صحنهٔ ۳)
 *  - حالت bw: سیاه‌وسفید کارگاهی با هاشور پرت (صحنهٔ ۴) — دقیقاً مثل نقشهٔ
 *    فعلی برنامه: نام + «طول/عرض» درشت در مرکز و «علائم خطی» عملیات زیر هر
 *    عدد (خط ممتد = نوار، خط‌چین = شیار، حرف «ف» کنار عدد = فارسی ۴۵°؛
 *    دو لبه = علامت دوتایی و ترکیب نوار+شیار زیر هم).
 * قطعات به‌ترتیب، از فریم مشخص‌شده و با فاصلهٔ stagger «فرود» می‌آیند.
 */

const PAD = 10; // دیگر متنی بیرون ورق نیست؛ حاشیه فقط برای قاب سفید

/* هندسهٔ علائم زیر ابعاد — نسبت به اندازهٔ فونت همان خط (em)، مثل خود برنامه */
const SYM_FIRST_EM = 0.66;
const SYM_STEP_EM = 0.26;
const SYM_GROUP_GAP_EM = 0.12;

interface AxisOps {
  band: number;
  groove: number;
  farsi: number;
}

/** شمارندهٔ عملیات یک محور از روی لبه‌های نمونه (محور طول قطعه یا عرض آن) */
const axisOps = (part: DemoPart, sides: OpSide[]): AxisOps => {
  const count = (label: OpLabel) =>
    part.ops.filter((op) => sides.includes(op.side) && op.label === label).length;
  return { band: count('نوار'), groove: count('شیار'), farsi: count('فارسی ۴۵°') };
};

interface CenterLine {
  text: string;
  size: number;
  ltr?: boolean;
  /** علائم عملیات زیر این خط (فقط برای خط‌های طول/عرض در حالت bw) */
  sym?: AxisOps;
  digitText?: string;
}

const farsiSuffixOf = (ops?: AxisOps): string =>
  ops && ops.farsi > 0 ? ` ${Array.from({ length: ops.farsi }, () => 'ف').join(' ')}` : '';

const symBottomEm = (line: CenterLine): number => {
  const rows = line.sym ? line.sym.band + line.sym.groove : 0;
  if (rows === 0) return 0.5;
  return (
    SYM_FIRST_EM +
    (rows - 1) * SYM_STEP_EM +
    (line.sym && line.sym.band > 0 && line.sym.groove > 0 ? SYM_GROUP_GAP_EM : 0) +
    0.08
  );
};
const stepPxOf = (line: CenterLine): number => (symBottomEm(line) + 0.68) * line.size;

interface SheetMapProps {
  mode: 'color' | 'bw';
  /** فریم شروع فرود قطعهٔ اول (نسبت به شروع صحنه) */
  startFrame?: number;
  /** فاصلهٔ فریم بین فرود قطعات */
  stagger?: number;
  /** نمایش علائم خطی عملیات زیر ابعاد (صحنهٔ ۴) */
  showOps?: boolean;
  /** فریم شروع ظاهرشدن علائم عملیات */
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

        // محور طول قطعه: برای قطعه‌ای که عمودی کشیده شده (درب بلند) محور طول
        // همان محور عمودی نقشه است و لبه‌هایش چپ/راست‌اند؛ بقیه افقی‌اند.
        const drawnRotated = part.h > part.w;
        const lenOps = axisOps(part, drawnRotated ? ['left', 'right'] : ['top', 'bottom']);
        const widOps = axisOps(part, drawnRotated ? ['top', 'bottom'] : ['left', 'right']);

        // متن مرکز مثل خود برنامه: قطعهٔ جادار = نام + «طول: …» + «عرض: …»
        // با علائم خطی زیر هر عدد؛ قطعهٔ کم‌ارتفاع = فقط ابعاد فشرده
        const centerLines: CenterLine[] =
          part.w >= 190 && part.h >= 125
            ? [
                { text: part.name, size: 23 },
                { text: `طول: ${dimL}`, size: 21, sym: lenOps, digitText: dimL },
                { text: `عرض: ${dimW}`, size: 21, sym: widOps, digitText: dimW },
              ]
            : part.w >= 190 && part.h >= 66
              ? [{ text: part.dims, size: 19, ltr: true }]
              : [];
        // در حالت رنگی (صحنهٔ ۳) نام + ابعاد فشرده خواناتر است
        const lines: CenterLine[] = bw
          ? centerLines
          : part.w >= 190 && part.h >= 72
            ? [
                { text: part.name, size: 23 },
                { text: part.dims, size: 19, ltr: true },
              ]
            : [];

        // مراکز عمودی خط‌ها با احتساب ردیف‌های علائم
        const centers: number[] = [];
        if (lines.length > 0) {
          const totalH =
            lines.slice(0, -1).reduce((sum, l) => sum + stepPxOf(l), 0) +
            lines[0].size * 0.5 +
            symBottomEm(lines[lines.length - 1]) * lines[lines.length - 1].size;
          let cursor = cy - totalH / 2 + lines[0].size * 0.5;
          for (const l of lines) {
            centers.push(cursor);
            cursor += stepPxOf(l);
          }
        }

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
            {lines.map((line, li) => {
              const yLine = centers[li];
              const suffix = bw && showOps ? farsiSuffixOf(line.sym) : '';
              // مرکز عدد در متن راست‌به‌چپ (ف‌ها سمت چپ عدد می‌نشینند)
              const fullText = line.text + suffix;
              const lineW = fullText.length * line.size * 0.6;
              const digitsW = (line.digitText ?? '').length * line.size * 0.6;
              const farsiW = suffix.length * line.size * 0.6;
              const ux = cx - lineW / 2 + farsiW + digitsW / 2;
              const uHalf = Math.max(digitsW * 0.62, line.size * 0.55);

              const rows: { y: number; dashed: boolean }[] = [];
              if (bw && showOps && line.sym) {
                let off = SYM_FIRST_EM;
                for (let k = 0; k < line.sym.band; k += 1) {
                  rows.push({ y: yLine + off * line.size, dashed: false });
                  off += SYM_STEP_EM;
                }
                if (line.sym.band > 0 && line.sym.groove > 0) off += SYM_GROUP_GAP_EM;
                for (let k = 0; k < line.sym.groove; k += 1) {
                  rows.push({ y: yLine + off * line.size, dashed: true });
                  off += SYM_STEP_EM;
                }
              }

              return (
                <g key={li}>
                  <text
                    x={cx}
                    y={yLine}
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
                    {suffix && <tspan opacity={opsOpacity}>{suffix}</tspan>}
                  </text>
                  {rows.length > 0 && (
                    <g opacity={opsOpacity}>
                      {rows.map((row, r) => (
                        <line
                          key={r}
                          x1={ux - uHalf}
                          x2={ux + uHalf}
                          y1={row.y}
                          y2={row.y}
                          stroke={ink}
                          strokeWidth={Math.max(1.4, line.size * 0.105)}
                          strokeLinecap="round"
                          strokeDasharray={row.dashed ? `${line.size * 0.3} ${line.size * 0.2}` : undefined}
                        />
                      ))}
                    </g>
                  )}
                </g>
              );
            })}
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
