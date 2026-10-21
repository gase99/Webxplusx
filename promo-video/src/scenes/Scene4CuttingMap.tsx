import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { Caption } from '../components/Caption';
import { SheetMap } from '../components/SheetMap';
import { FONT_FAMILY } from '../lib/font';
import { COLORS } from '../lib/theme';

/** صحنهٔ ۴ — نقشهٔ برش سیاه‌وسفید: پیکان‌های عملیات + هاشور پرت + زوم روی یک قطعه */
export const Scene4CuttingMap: React.FC = () => {
  const frame = useCurrentFrame();

  // دوربین: از نمای کامل به زوم روی قطعهٔ «درب بلند» (داخل ورق)
  const zoom = interpolate(frame, [105, 150, 185, 205], [1, 1.85, 1.85, 1.25], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const originX = interpolate(frame, [105, 150], [50, 66], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const originY = interpolate(frame, [105, 150], [50, 64], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  const calloutOpacity = interpolate(frame, [150, 168, 196, 208], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ fontFamily: FONT_FAMILY }}>
      <div
        style={{
          position: 'absolute',
          top: 86,
          left: 0,
          right: 0,
          textAlign: 'center',
          color: COLORS.white,
          fontSize: 54,
          fontWeight: 800,
        }}
      >
        نقشهٔ برش کارگاهی
      </div>

      {/* قاب نقشه با قابلیت «دوربین» */}
      <div
        style={{
          position: 'absolute',
          top: 178,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 1440,
          height: 688,
          backgroundColor: '#ffffff',
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: '0 40px 110px rgba(0,0,0,0.55)',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            transform: `scale(${zoom})`,
            transformOrigin: `${originX}% ${originY}%`,
          }}
        >
          <SheetMap
            mode="bw"
            startFrame={-200}
            stagger={0}
            showArrows
            arrowStartFrame={34}
            highlightIndex={8}
            highlightFromFrame={146}
          />
        </div>

        {/* برچسب توضیحی روی زوم */}
        <div
          style={{
            position: 'absolute',
            top: 30,
            insetInlineEnd: 34,
            opacity: calloutOpacity,
            backgroundColor: '#052e22',
            color: '#ecfdf5',
            border: `2px solid ${COLORS.emerald}`,
            borderRadius: 16,
            padding: '16px 28px',
            fontSize: 32,
            fontWeight: 800,
            boxShadow: '0 16px 44px rgba(0,0,0,0.35)',
          }}
        >
          پیکانِ بیرون هر لبه = عملیات همان لبه
        </div>
      </div>

      {/* راهنمای پایین نقشه */}
      <div
        style={{
          position: 'absolute',
          top: 876,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 18,
          opacity: interpolate(frame, [56, 78], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }}
      >
        {[
          { label: 'هاشور = پرت / باقی‌ماندهٔ ورق', color: COLORS.slate300 },
          { label: 'چاپ سیاه‌وسفید، خوانا در کارگاه', color: COLORS.skySoft },
          { label: 'نام و ابعاد هر قطعه روی خودش', color: COLORS.emeraldLight },
        ].map((chip) => (
          <span
            key={chip.label}
            style={{
              color: chip.color,
              border: '1.5px solid rgba(148,163,184,0.4)',
              backgroundColor: 'rgba(2,6,23,0.65)',
              borderRadius: 999,
              padding: '10px 26px',
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            {chip.label}
          </span>
        ))}
      </div>

      <Caption text="نقشهٔ سیاه‌وسفید با پیکان عملیات هر لبه و هاشور پرت" delay={12} />
    </AbsoluteFill>
  );
};
