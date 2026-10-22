import React from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Caption } from '../components/Caption';
import { FONT_FAMILY } from '../lib/font';
import { COLORS } from '../lib/theme';

const Card: React.FC<{
  title: string;
  subtitle: string;
  accent: string;
  delay: number;
  children: React.ReactNode;
}> = ({ title, subtitle, accent, delay, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 90, stiffness: 110 } });
  return (
    <div
      style={{
        width: 520,
        height: 560,
        opacity: p,
        transform: `translateY(${(1 - p) * 90}px) rotate(${(1 - p) * 2.5}deg)`,
        backgroundColor: '#ffffff',
        borderRadius: 26,
        boxShadow: '0 36px 90px rgba(0,0,0,0.5)',
        padding: '30px 34px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
        <span style={{ width: 18, height: 44, borderRadius: 6, backgroundColor: accent }} />
        <span style={{ fontSize: 40, fontWeight: 900, color: COLORS.ink }}>{title}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 600, color: '#64748b', marginBottom: 20 }}>{subtitle}</div>
      {children}
    </div>
  );
};

/** ماکت برگهٔ چاپی A4 (مینی نقشه + سطرهای جدول + فاکتور) */
const PrintSheetThumb: React.FC = () => (
  <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
    <svg viewBox="0 0 200 92" style={{ width: '100%', border: '2px solid #0f172a', borderRadius: 4 }}>
      <defs>
        <pattern id="thumb-hatch" patternUnits="userSpaceOnUse" width={7} height={7} patternTransform="rotate(45)">
          <rect width={7} height={7} fill="#fff" />
          <line x1={0} y1={0} x2={0} y2={7} stroke="#94a3b8" strokeWidth={1.6} />
        </pattern>
      </defs>
      <rect width={200} height={92} fill="url(#thumb-hatch)" />
      <rect x={2} y={2} width={58} height={42} fill="#fff" stroke="#0f172a" strokeWidth={1.6} />
      <rect x={63} y={2} width={50} height={42} fill="#fff" stroke="#0f172a" strokeWidth={1.6} />
      <rect x={116} y={2} width={82} height={26} fill="#fff" stroke="#0f172a" strokeWidth={1.6} />
      <rect x={2} y={47} width={52} height={43} fill="#fff" stroke="#0f172a" strokeWidth={1.6} />
      <rect x={57} y={47} width={56} height={43} fill="#fff" stroke="#0f172a" strokeWidth={1.6} />
      <rect x={116} y={31} width={38} height={59} fill="#fff" stroke="#0f172a" strokeWidth={1.6} />
    </svg>
    {[86, 72, 92, 64].map((w, i) => (
      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ width: 20, height: 20, border: '2.5px solid #0f172a', borderRadius: 4, flexShrink: 0 }} />
        <span style={{ height: 13, width: `${w}%`, backgroundColor: i % 2 ? '#cbd5e1' : '#94a3b8', borderRadius: 6 }} />
      </div>
    ))}
    <div style={{ marginTop: 'auto', display: 'flex', gap: 10 }}>
      {['۱۵٫۷ m نوار', '۵٫۷ m فارسی', '۲٫۶ m شیار'].map((t) => (
        <span
          key={t}
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 22,
            fontWeight: 800,
            color: '#0f172a',
            border: '2px solid #0f172a',
            borderRadius: 10,
            padding: '8px 0',
            backgroundColor: '#f1f5f9',
          }}
        >
          {t}
        </span>
      ))}
    </div>
  </div>
);

/** ماکت کارت DXF */
const DxfThumb: React.FC = () => (
  <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        backgroundColor: '#0f172a',
        borderRadius: 14,
        padding: '16px 20px',
      }}
    >
      <span style={{ fontSize: 34 }}>⬇️</span>
      <span dir="ltr" style={{ fontSize: 25, fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace' }}>
        ACut_3660x1830.dxf
      </span>
    </div>
    {[
      { layer: 'CUT', fa: 'خط برش قطعات', color: '#0f172a' },
      { layer: 'GROOVE', fa: 'خط شیار', color: '#ea580c' },
      { layer: 'FARSI_45', fa: 'فارسی ۴۵°', color: '#dc2626' },
      { layer: 'LABEL', fa: 'کد قطعه (S1-03)', color: '#2563eb' },
    ].map((row) => (
      <div key={row.layer} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ width: 44, height: 0, borderTop: `5px solid ${row.color}`, borderRadius: 3, flexShrink: 0 }} />
        <span dir="ltr" style={{ fontSize: 27, fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', width: 170, textAlign: 'left' }}>
          {row.layer}
        </span>
        <span style={{ fontSize: 25, fontWeight: 600, color: '#475569' }}>{row.fa}</span>
      </div>
    ))}
    <div
      style={{
        marginTop: 'auto',
        textAlign: 'center',
        fontSize: 27,
        fontWeight: 800,
        color: '#ffffff',
        backgroundColor: COLORS.sky,
        borderRadius: 12,
        padding: '12px 0',
      }}
    >
      آمادهٔ اجرا روی CNC
    </div>
  </div>
);

/** ماکت شبکهٔ لیبل‌ها */
const LabelsThumb: React.FC = () => (
  <div style={{ flexGrow: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
    {['S1-01', 'S1-02', 'S1-03', 'S1-04', 'S1-05', 'S1-06', 'S1-07', 'S1-08', 'S1-09'].map((code, i) => (
      <div
        key={code}
        style={{
          border: '2px dashed #94a3b8',
          borderRadius: 10,
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          backgroundColor: i % 2 ? '#ffffff' : '#f8fafc',
        }}
      >
        <span
          dir="ltr"
          style={{
            alignSelf: 'flex-start',
            backgroundColor: '#1e293b',
            color: '#ffffff',
            fontSize: 20,
            fontWeight: 800,
            borderRadius: 6,
            padding: '2px 9px',
            fontFamily: 'monospace',
          }}
        >
          {code}
        </span>
        <span style={{ height: 12, width: '85%', backgroundColor: '#94a3b8', borderRadius: 5 }} />
        <span style={{ height: 12, width: '62%', backgroundColor: '#cbd5e1', borderRadius: 5 }} />
        <span style={{ height: 12, width: '74%', backgroundColor: '#cbd5e1', borderRadius: 5 }} />
      </div>
    ))}
  </div>
);

/** صحنهٔ ۵ — خروجی‌ها: چاپ A4 تفکیک‌شده + DXF + لیبل‌ها (+ PDF موبایل) */
export const Scene5Outputs: React.FC = () => {
  return (
    <AbsoluteFill style={{ fontFamily: FONT_FAMILY }}>
      <div
        style={{
          position: 'absolute',
          top: 92,
          left: 0,
          right: 0,
          textAlign: 'center',
          color: COLORS.white,
          fontSize: 54,
          fontWeight: 800,
        }}
      >
        خروجی‌های آمادهٔ تولید
      </div>

      <div
        style={{
          position: 'absolute',
          top: 220,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 34,
        }}
      >
        <Card title="چاپ A4 تفکیک‌شده" subtitle="هر ورق روی برگهٔ جدا + لیست قطعات و فاکتور" accent={COLORS.sky} delay={6}>
          <PrintSheetThumb />
        </Card>
        <Card title="فایل DXF" subtitle="لایه‌های جدا برای دستگاه CNC" accent={COLORS.emerald} delay={20}>
          <DxfThumb />
        </Card>
        <Card title="لیبل قطعات" subtitle="شبکهٔ ۳×۵ با همان کد روی نقشه و DXF" accent="#d97706" delay={34}>
          <LabelsThumb />
        </Card>
      </div>

      {/* یادداشت خروجی PDF در موبایل */}
      <div
        style={{
          position: 'absolute',
          top: 820,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            backgroundColor: 'rgba(2,132,199,0.2)',
            border: '1.5px solid rgba(125,211,252,0.5)',
            color: COLORS.skySoft,
            borderRadius: 999,
            padding: '12px 34px',
            fontSize: 30,
            fontWeight: 800,
          }}
        >
          روی گوشی، همین خروجی‌ها به‌صورت PDF دانلود و اشتراک‌گذاری می‌شوند
        </span>
      </div>

      <Caption text="از محاسبه تا تولید: چاپ A4، DXF برای CNC و لیبل هر قطعه" delay={10} />
    </AbsoluteFill>
  );
};
