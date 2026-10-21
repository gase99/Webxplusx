import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { Caption } from '../components/Caption';
import { SheetMap } from '../components/SheetMap';
import { FONT_FAMILY } from '../lib/font';
import { DEMO_UTILIZATION } from '../lib/layout';
import { COLORS, faNum } from '../lib/theme';

const CLICK_AT = 34;
const PARTS_FROM = 52;
const STAGGER = 13;

/** صحنهٔ ۳ — کلیک «محاسبهٔ چیدمان» و چیده‌شدن قطعات روی ورق (گیلوتینی) */
export const Scene3Calculate: React.FC = () => {
  const frame = useCurrentFrame();

  // حرکت نشانگر موس به سمت دکمه و کلیک
  const cursorX = interpolate(frame, [4, CLICK_AT], [1330, 960], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const cursorY = interpolate(frame, [4, CLICK_AT], [780, 196], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const pressed = frame >= CLICK_AT && frame <= CLICK_AT + 9;
  const buttonScale = pressed ? 0.955 : 1;
  const ripple = interpolate(frame, [CLICK_AT, CLICK_AT + 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // شمارندهٔ بهره‌وری هم‌گام با فرود قطعات
  const utilEnd = PARTS_FROM + 9 * STAGGER + 16;
  const util = interpolate(frame, [PARTS_FROM, utilEnd], [0, DEMO_UTILIZATION], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ fontFamily: FONT_FAMILY }}>
      {/* دکمهٔ محاسبه + نشانگر موس */}
      <div
        style={{
          position: 'absolute',
          top: 118,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div style={{ position: 'relative' }}>
          <div
            style={{
              transform: `scale(${buttonScale})`,
              backgroundColor: COLORS.emerald,
              color: '#ffffff',
              fontSize: 46,
              fontWeight: 900,
              padding: '26px 64px',
              borderRadius: 22,
              boxShadow: '0 24px 60px rgba(5,150,105,0.45)',
              display: 'flex',
              alignItems: 'center',
              gap: 18,
            }}
          >
            <span style={{ fontSize: 40 }}>▶</span>
            محاسبهٔ چیدمان
          </div>
          {/* موج کلیک */}
          <div
            style={{
              position: 'absolute',
              inset: -6,
              borderRadius: 26,
              border: `4px solid ${COLORS.emeraldLight}`,
              opacity: ripple > 0 ? (1 - ripple) * 0.9 : 0,
              transform: `scale(${1 + ripple * 0.14})`,
            }}
          />
        </div>
      </div>

      {/* نشانگر موس */}
      <svg width={54} height={54} viewBox="0 0 24 24" style={{ position: 'absolute', left: cursorX, top: cursorY, filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.5))', opacity: interpolate(frame, [CLICK_AT + 16, CLICK_AT + 30], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
        <path d="M4 2 L20 12 L12.5 13.5 L16 21 L12.5 22.5 L9 14.7 L4 19 Z" fill="#ffffff" stroke="#0f172a" strokeWidth={1.6} strokeLinejoin="round" />
      </svg>

      {/* ورق و فرود قطعات */}
      <div
        style={{
          position: 'absolute',
          top: 262,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 1400,
          height: 600,
          backgroundColor: '#ffffff',
          borderRadius: 22,
          padding: 18,
          boxShadow: '0 40px 110px rgba(0,0,0,0.5)',
          opacity: interpolate(frame, [CLICK_AT - 6, CLICK_AT + 10], [0.35, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        <SheetMap mode="color" startFrame={PARTS_FROM} stagger={STAGGER} />
      </div>

      {/* شمارندهٔ بهره‌وری — شناور روی لبهٔ پایینی قاب نقشه تا با زیرنویس تداخل نکند */}
      <div
        style={{
          position: 'absolute',
          top: 824,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 22,
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(2,6,23,0.8)',
            border: '1.5px solid rgba(52,211,153,0.5)',
            borderRadius: 20,
            padding: '16px 40px',
            color: COLORS.white,
            fontSize: 38,
            fontWeight: 800,
          }}
        >
          بهره‌وری ورق:{' '}
          <span style={{ color: COLORS.emeraldLight, fontSize: 46 }}>{faNum(util, 1)}٪</span>
        </div>
        <div
          style={{
            backgroundColor: 'rgba(2,6,23,0.8)',
            border: '1.5px solid rgba(125,211,252,0.4)',
            borderRadius: 20,
            padding: '16px 40px',
            color: COLORS.white,
            fontSize: 38,
            fontWeight: 800,
          }}
        >
          ورق خام: <span dir="ltr" style={{ color: COLORS.skySoft }}>۳۶۶۰ × ۱۸۳۰</span>
        </div>
      </div>

      <Caption text="با یک کلیک، الگوریتم گیلوتینی بهترین چیدمان را پیدا می‌کند" delay={16} />
    </AbsoluteFill>
  );
};
