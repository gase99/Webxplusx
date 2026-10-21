import React from 'react';
import { AbsoluteFill } from 'remotion';
import { COLORS } from '../lib/theme';

/**
 * پس‌زمینهٔ ثابت کل ویدیو: گرادیان سرمه‌ای + هالهٔ آبی + شبکهٔ ظریف
 * (تداعی‌گر خطوط نقشهٔ فنی روی میز برش).
 */
export const Backdrop: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse 90% 70% at 85% 0%, rgba(2,132,199,0.38) 0%, rgba(2,132,199,0) 55%),' +
            'radial-gradient(ellipse 70% 60% at 5% 100%, rgba(5,150,105,0.22) 0%, rgba(5,150,105,0) 55%),' +
            `linear-gradient(160deg, ${COLORS.bg} 0%, ${COLORS.bgDeep} 100%)`,
        }}
      />
      {/* شبکهٔ خط‌چین نقشه */}
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.07) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
      {/* خط مورب امضای لوگو، بسیار کم‌رنگ در پس‌زمینه */}
      <div
        style={{
          position: 'absolute',
          width: 1400,
          height: 150,
          right: -420,
          top: 120,
          background: 'linear-gradient(90deg, rgba(56,189,248,0.10), rgba(56,189,248,0.28), rgba(56,189,248,0.10))',
          transform: 'rotate(-38deg)',
          borderRadius: 8,
        }}
      />
    </AbsoluteFill>
  );
};
