import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Caption } from '../components/Caption';
import { FONT_FAMILY } from '../lib/font';
import { COLORS } from '../lib/theme';

/** متن تایپ‌شونده: از فریم from با سرعت charsPer تناوبی */
const typed = (frame: number, text: string, from: number, framesPerChar = 7): string => {
  const n = Math.floor((frame - from) / framesPerChar);
  return text.slice(0, Math.max(0, Math.min(text.length, n)));
};

const Caret: React.FC<{ visible: boolean }> = ({ visible }) => {
  const frame = useCurrentFrame();
  const blink = Math.floor(frame / 14) % 2 === 0;
  if (!visible) return null;
  return (
    <span
      style={{
        display: 'inline-block',
        width: 3,
        height: 30,
        marginInlineStart: 3,
        backgroundColor: COLORS.sky,
        opacity: blink ? 1 : 0,
        verticalAlign: 'middle',
      }}
    />
  );
};

const Cell: React.FC<{
  width: number;
  children: React.ReactNode;
  active?: boolean;
  dim?: boolean;
  ltr?: boolean;
}> = ({ width, children, active, dim, ltr }) => (
  <div
    dir={ltr ? 'ltr' : undefined}
    style={{
      width,
      height: 76,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: active ? '#f0f9ff' : '#ffffff',
      border: active ? `3px solid ${COLORS.sky}` : '2px solid #cbd5e1',
      borderRadius: 14,
      fontSize: 34,
      fontWeight: 800,
      color: dim ? '#94a3b8' : COLORS.ink,
      fontFamily: FONT_FAMILY,
      boxShadow: active ? '0 0 0 6px rgba(56,189,248,0.18)' : 'none',
      flexShrink: 0,
    }}
  >
    {children}
  </div>
);

/** صحنهٔ ۲ — ورود داده: تایپ ابعاد ۱۵۰×۴۵۰ و انتخاب عملیات لبه (۰/۱/۲) */
export const Scene2DataEntry: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardIn = spring({ frame, fps, config: { damping: 100, stiffness: 110 } });

  // خط زمانی تایپ داخل صحنه
  const name = typed(frame, 'طبقهٔ کمد', 18, 5);
  const length = typed(frame, '450', 62, 9);
  const width = typed(frame, '150', 92, 9);
  const qty = typed(frame, '6', 118, 9);

  const ops: { label: string; value: string; from: number; color: string }[] = [
    { label: 'نوار طول', value: '۲', from: 126, color: '#0d9488' },
    { label: 'فارسی ۴۵° طول', value: '۲', from: 140, color: '#dc2626' },
    { label: 'شیار عرض', value: '۱', from: 154, color: '#d97706' },
  ];

  const headerCell = (text: string, w: number): React.ReactNode => (
    <div key={text} style={{ width: w, textAlign: 'center', fontSize: 26, fontWeight: 700, color: '#64748b', flexShrink: 0 }}>
      {text}
    </div>
  );

  return (
    <AbsoluteFill style={{ fontFamily: FONT_FAMILY }}>
      <div
        style={{
          position: 'absolute',
          top: 120,
          left: 0,
          right: 0,
          textAlign: 'center',
          color: COLORS.white,
          fontSize: 54,
          fontWeight: 800,
          opacity: cardIn,
        }}
      >
        ورود اطلاعات قطعات
      </div>

      <div
        style={{
          position: 'absolute',
          top: 240,
          left: '50%',
          transform: `translateX(-50%) translateY(${(1 - cardIn) * 40}px)`,
          opacity: cardIn,
          width: 1540,
          backgroundColor: '#ffffff',
          borderRadius: 28,
          boxShadow: '0 40px 110px rgba(0,0,0,0.5)',
          padding: '36px 44px 40px',
        }}
      >
        {/* نوار عنوان پنجره */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 26 }}>
          <span style={{ width: 16, height: 16, borderRadius: 99, backgroundColor: '#f87171' }} />
          <span style={{ width: 16, height: 16, borderRadius: 99, backgroundColor: '#fbbf24' }} />
          <span style={{ width: 16, height: 16, borderRadius: 99, backgroundColor: '#34d399' }} />
          <span style={{ marginInlineStart: 14, fontSize: 26, fontWeight: 700, color: '#64748b' }}>
            جدول قطعات — پروژهٔ کمد دیواری
          </span>
        </div>

        {/* سرستون‌ها */}
        <div style={{ display: 'flex', gap: 18, justifyContent: 'center', marginBottom: 12 }}>
          {headerCell('نام قطعه', 400)}
          {headerCell('طول (mm)', 240)}
          {headerCell('عرض (mm)', 240)}
          {headerCell('تعداد', 180)}
        </div>

        {/* ردیف در حال تایپ */}
        <div style={{ display: 'flex', gap: 18, justifyContent: 'center' }}>
          <Cell width={400} active={frame < 62}>
            {name}
            <Caret visible={frame >= 18 && frame < 62} />
          </Cell>
          <Cell width={240} ltr active={frame >= 62 && frame < 92}>
            {length}
            <Caret visible={frame >= 62 && frame < 92} />
          </Cell>
          <Cell width={240} ltr active={frame >= 92 && frame < 118}>
            {width}
            <Caret visible={frame >= 92 && frame < 118} />
          </Cell>
          <Cell width={180} ltr active={frame >= 118 && frame < 132}>
            {qty}
            <Caret visible={frame >= 118 && frame < 132} />
          </Cell>
        </div>

        {/* ردیف آمادهٔ دوم */}
        <div style={{ display: 'flex', gap: 18, justifyContent: 'center', marginTop: 16, opacity: 0.55 }}>
          <Cell width={400} dim>درب کابینت</Cell>
          <Cell width={240} ltr dim>715</Cell>
          <Cell width={240} ltr dim>396</Cell>
          <Cell width={180} ltr dim>4</Cell>
        </div>

        {/* عملیات لبه‌ها با ورودی ۰/۱/۲ */}
        <div style={{ display: 'flex', gap: 18, justifyContent: 'center', marginTop: 34 }}>
          {ops.map((op) => {
            const p = spring({ frame: frame - op.from, fps, config: { damping: 80, stiffness: 160 } });
            const on = frame >= op.from;
            return (
              <div
                key={op.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 26px',
                  borderRadius: 18,
                  border: `3px solid ${on ? op.color : '#cbd5e1'}`,
                  backgroundColor: on ? '#f8fafc' : '#ffffff',
                  transform: `scale(${on ? 0.92 + p * 0.08 : 1})`,
                  boxShadow: on ? `0 10px 30px ${op.color}33` : 'none',
                }}
              >
                <span style={{ width: 16, height: 16, borderRadius: 99, backgroundColor: op.color }} />
                <span style={{ fontSize: 30, fontWeight: 800, color: COLORS.ink }}>{op.label}</span>
                <span
                  style={{
                    minWidth: 56,
                    textAlign: 'center',
                    fontSize: 34,
                    fontWeight: 900,
                    color: '#ffffff',
                    backgroundColor: on ? op.color : '#94a3b8',
                    borderRadius: 12,
                    padding: '2px 10px',
                  }}
                >
                  {on ? op.value : '۰'}
                </span>
              </div>
            );
          })}
        </div>
        <div
          style={{
            textAlign: 'center',
            marginTop: 20,
            fontSize: 27,
            fontWeight: 600,
            color: '#64748b',
            opacity: interpolate(frame, [120, 140], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          }}
        >
          ۰ = بدون عملیات ‏·‏ ۱ = یک لبه ‏·‏ ۲ = هر دو لبهٔ مقابل
        </div>
      </div>

      <Caption text="ورود سریع قطعات — برای هر لبه: نوار، فارسی ۴۵° و شیار" delay={14} />
    </AbsoluteFill>
  );
};
