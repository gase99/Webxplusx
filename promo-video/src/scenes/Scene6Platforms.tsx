import React from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Caption } from '../components/Caption';
import { FONT_FAMILY } from '../lib/font';
import { COLORS } from '../lib/theme';

const GlobeIcon: React.FC = () => (
  <svg width={110} height={110} viewBox="0 0 24 24" fill="none" stroke={COLORS.skyLight} strokeWidth={1.7}>
    <circle cx={12} cy={12} r={9} />
    <path d="M3 12h18M12 3c2.7 2.6 4 5.7 4 9s-1.3 6.4-4 9c-2.7-2.6-4-5.7-4-9s1.3-6.4 4-9Z" />
  </svg>
);

const AndroidIcon: React.FC = () => (
  <svg width={110} height={110} viewBox="0 0 24 24" fill="#3ddc84">
    <path d="M6.4 4.3 5.2 2.7a.35.35 0 0 1 .57-.4l1.37 1.63A9.6 9.6 0 0 1 12 3c1.77 0 3.43.33 4.86.93L18.23 2.3a.35.35 0 1 1 .57.4l-1.21 1.6A8.9 8.9 0 0 1 20.5 10H3.5a8.9 8.9 0 0 1 2.9-5.7ZM7.5 8.2a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM3.5 11.5v7a2 2 0 0 0 4 0v-5h1v7.3a1.7 1.7 0 0 0 3.4 0V13.5h.2v7.3a1.7 1.7 0 0 0 3.4 0V13.5h1v5a2 2 0 0 0 4 0v-7" />
  </svg>
);

const WindowsIcon: React.FC = () => (
  <svg width={100} height={100} viewBox="0 0 24 24" fill="#38bdf8">
    <path d="M3 4.6 10.8 3.5v7.2H3zM12.3 3.3 21 2v8.7h-8.7zM3 12.1h7.8v7.3L3 18.3zM12.3 12.1H21V21l-8.7-1.3z" />
  </svg>
);

const PlatformCard: React.FC<{
  title: string;
  desc: string;
  delay: number;
  icon: React.ReactNode;
}> = ({ title, desc, delay, icon }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 85, stiffness: 120, mass: 1 } });
  return (
    <div
      style={{
        width: 480,
        opacity: p,
        transform: `translateY(${(1 - p) * 80}px) scale(${0.92 + p * 0.08})`,
        backgroundColor: 'rgba(15,23,42,0.85)',
        border: '2px solid rgba(125,211,252,0.35)',
        borderRadius: 30,
        padding: '44px 36px 40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
      }}
    >
      {icon}
      <div style={{ fontSize: 48, fontWeight: 900, color: COLORS.white, marginTop: 12 }}>{title}</div>
      <div style={{ fontSize: 29, fontWeight: 600, color: COLORS.slate300, textAlign: 'center', lineHeight: 1.6 }}>
        {desc}
      </div>
    </div>
  );
};

/** صحنهٔ ۶ — پلتفرم‌ها: وب (PWA) + اندروید + ویندوز و ذخیرهٔ محلی پروژه‌ها */
export const Scene6Platforms: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const chips = ['ذخیرهٔ خودکار پروژه‌ها روی دستگاه شما', 'بدون سرور و بدون ثبت‌نام', 'کاملاً آفلاین', 'رایگان و متن‌باز'];

  return (
    <AbsoluteFill style={{ fontFamily: FONT_FAMILY }}>
      <div
        style={{
          position: 'absolute',
          top: 104,
          left: 0,
          right: 0,
          textAlign: 'center',
          color: COLORS.white,
          fontSize: 54,
          fontWeight: 800,
        }}
      >
        هرجا که باشید، دم دست است
      </div>

      <div
        style={{
          position: 'absolute',
          top: 250,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 36,
        }}
      >
        <PlatformCard
          title="وب (PWA)"
          desc="در مرورگر اجرا و مثل اپ نصب می‌شود؛ حتی بدون اینترنت"
          delay={6}
          icon={<GlobeIcon />}
        />
        <PlatformCard title="اندروید" desc="نسخهٔ بومی APK برای گوشی و تبلت" delay={20} icon={<AndroidIcon />} />
        <PlatformCard title="ویندوز" desc="نسخهٔ دسکتاپ برای کارگاه و دفتر" delay={34} icon={<WindowsIcon />} />
      </div>

      <div
        style={{
          position: 'absolute',
          top: 800,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        {chips.map((chip, i) => {
          const p = spring({ frame: frame - (52 + i * 9), fps, config: { damping: 100, stiffness: 150 } });
          return (
            <span
              key={chip}
              style={{
                opacity: p,
                transform: `translateY(${(1 - p) * 20}px)`,
                color: COLORS.emeraldLight,
                border: '1.5px solid rgba(52,211,153,0.5)',
                backgroundColor: 'rgba(5,150,105,0.16)',
                borderRadius: 999,
                padding: '12px 30px',
                fontSize: 29,
                fontWeight: 800,
              }}
            >
              {chip}
            </span>
          );
        })}
      </div>

      <Caption text="وب، اندروید و ویندوز — پروژه‌ها خودکار روی دستگاه شما ذخیره می‌شوند" delay={10} />
    </AbsoluteFill>
  );
};
