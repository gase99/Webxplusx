import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT_FAMILY } from '../lib/font';
import { COLORS } from '../lib/theme';

const InstagramIcon: React.FC = () => (
  <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#f472b6" strokeWidth={1.9}>
    <rect x={3} y={3} width={18} height={18} rx={5} />
    <circle cx={12} cy={12} r={4} />
    <circle cx={17.2} cy={6.8} r={0.6} fill="#f472b6" stroke="none" />
  </svg>
);

const TelegramIcon: React.FC = () => (
  <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth={1.9} strokeLinejoin="round">
    <path d="M22 2 11 13" />
    <path d="M22 2 15 22l-4-9-9-4Z" />
  </svg>
);

const SocialRow: React.FC<{ icon: React.ReactNode; label: string; handle: string; delay: number }> = ({
  icon,
  label,
  handle,
  delay,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 100, stiffness: 150 } });
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        opacity: p,
        transform: `translateY(${(1 - p) * 20}px)`,
        backgroundColor: 'rgba(15,23,42,0.85)',
        border: '1.5px solid rgba(148,163,184,0.4)',
        borderRadius: 999,
        padding: '14px 34px',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
      <span style={{ fontSize: 31, fontWeight: 700, color: COLORS.slate300 }}>{label}:</span>
      <span dir="ltr" style={{ fontSize: 34, fontWeight: 900, color: COLORS.white }}>
        {handle}
      </span>
    </div>
  );
};

/** صحنهٔ ۷ — پایان: دعوت به اقدام + سازنده + شبکه‌های اجتماعی */
export const Scene7Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoIn = spring({ frame, fps, config: { damping: 90, stiffness: 110 } });
  const ctaIn = spring({ frame: frame - 22, fps, config: { damping: 80, stiffness: 130 } });
  const makerOpacity = interpolate(frame, [40, 56], [0, 1], {
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
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 30, opacity: logoIn, transform: `scale(${0.85 + logoIn * 0.15})` }}>
        <Img src={staticFile('logo.png')} style={{ width: 150, height: 150, borderRadius: 34 }} />
        <div dir="ltr" style={{ fontSize: 96, fontWeight: 900, color: COLORS.white, lineHeight: 1 }}>
          A-Cut <span style={{ color: COLORS.skyLight }}>2Dpro</span>
        </div>
      </div>

      <div
        style={{
          marginTop: 44,
          opacity: ctaIn,
          transform: `scale(${0.9 + ctaIn * 0.1})`,
          backgroundColor: COLORS.emerald,
          color: '#ffffff',
          fontSize: 44,
          fontWeight: 900,
          padding: '24px 60px',
          borderRadius: 999,
          boxShadow: '0 24px 60px rgba(5,150,105,0.5)',
        }}
      >
        همین حالا رایگان شروع کنید
      </div>
      <div dir="ltr" style={{ marginTop: 20, fontSize: 36, fontWeight: 700, color: COLORS.skySoft, opacity: ctaIn }}>
        gase99.github.io/Webxplusx
      </div>

      <div style={{ marginTop: 56, textAlign: 'center', opacity: makerOpacity }}>
        <div style={{ fontSize: 40, fontWeight: 800, color: COLORS.white }}>
          سازنده: عباس کروشاد
        </div>
        <div dir="ltr" style={{ fontSize: 28, fontWeight: 600, color: COLORS.slate400, marginTop: 6 }}>
          Abbas Koroushad
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, marginTop: 40 }}>
        <SocialRow icon={<InstagramIcon />} label="اینستاگرام" handle="@Webxplusx" delay={58} />
        <SocialRow icon={<TelegramIcon />} label="تلگرام" handle="@Webxplusx" delay={68} />
      </div>
    </AbsoluteFill>
  );
};
