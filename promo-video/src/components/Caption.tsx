import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT_FAMILY } from '../lib/font';
import { COLORS } from '../lib/theme';

interface CaptionProps {
  text: string;
  /** فریم شروع ورود زیرنویس (نسبت به شروع صحنه) */
  delay?: number;
}

/**
 * نوار زیرنویس/پیام هر صحنه — پایین قاب، خوانا و مناسب تماشای بدون صدا.
 */
export const Caption: React.FC<CaptionProps> = ({ text, delay = 8 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame: frame - delay, fps, config: { damping: 100, stiffness: 140 } });
  const opacity = interpolate(frame, [delay, delay + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 56,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        opacity,
        transform: `translateY(${(1 - enter) * 26}px)`,
        fontFamily: FONT_FAMILY,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          backgroundColor: 'rgba(2,6,23,0.78)',
          border: '1px solid rgba(125,211,252,0.35)',
          borderRadius: 999,
          padding: '18px 40px',
          boxShadow: '0 18px 50px rgba(0,0,0,0.45)',
        }}
      >
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            backgroundColor: COLORS.emeraldLight,
            boxShadow: '0 0 18px rgba(52,211,153,0.9)',
            flexShrink: 0,
          }}
        />
        <span style={{ color: COLORS.white, fontSize: 38, fontWeight: 700, lineHeight: 1.35 }}>
          {text}
        </span>
      </div>
    </div>
  );
};
