import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT_FAMILY } from '../lib/font';
import { COLORS } from '../lib/theme';

const CHIPS = ['الگوریتم گیلوتینی', 'نقشهٔ کارگاهی', 'خروجی DXF برای CNC', 'کاملاً آفلاین'];

/** صحنهٔ ۱ — معرفی: لوگو + نام نرم‌افزار + شعار */
export const Scene1Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoIn = spring({ frame, fps, config: { damping: 80, stiffness: 90, mass: 1.1 } });
  const titleIn = spring({ frame: frame - 16, fps, config: { damping: 100, stiffness: 120 } });
  const sloganOpacity = interpolate(frame, [34, 52], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        fontFamily: FONT_FAMILY,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
      }}
    >
      <div
        style={{
          transform: `scale(${0.55 + logoIn * 0.45}) rotate(${(1 - logoIn) * -8}deg)`,
          opacity: logoIn,
          filter: 'drop-shadow(0 30px 60px rgba(2,132,199,0.45))',
        }}
      >
        <Img src={staticFile('logo.png')} style={{ width: 250, height: 250, borderRadius: 56 }} />
      </div>

      <div
        dir="ltr"
        style={{
          marginTop: 26,
          fontSize: 128,
          fontWeight: 900,
          color: COLORS.white,
          letterSpacing: -1,
          lineHeight: 1.05,
          opacity: titleIn,
          transform: `translateY(${(1 - titleIn) * 34}px)`,
        }}
      >
        A-Cut <span style={{ color: COLORS.skyLight }}>2Dpro</span>
      </div>

      <div
        style={{
          fontSize: 66,
          fontWeight: 800,
          color: COLORS.white,
          opacity: sloganOpacity,
          lineHeight: 1.4,
        }}
      >
        بهینه‌ساز هوشمند برش ورق
      </div>
      <div style={{ fontSize: 36, fontWeight: 500, color: COLORS.slate300, opacity: sloganOpacity }}>
        چوب و MDF، شیشه و فلز — کمترین پرت، بهترین چیدمان
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 42 }}>
        {CHIPS.map((chip, i) => {
          const p = spring({ frame: frame - (58 + i * 9), fps, config: { damping: 100, stiffness: 150 } });
          return (
            <div
              key={chip}
              style={{
                opacity: p,
                transform: `translateY(${(1 - p) * 22}px)`,
                border: '1.5px solid rgba(125,211,252,0.45)',
                backgroundColor: 'rgba(2,132,199,0.16)',
                color: COLORS.skySoft,
                fontSize: 29,
                fontWeight: 700,
                padding: '12px 28px',
                borderRadius: 999,
              }}
            >
              {chip}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
