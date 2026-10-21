import React from 'react';
import { Composition } from 'remotion';
import { PromoVideo, PROMO_FPS, PROMO_DURATION_FRAMES } from './Promo';

/**
 * ویدیوی معرفی A-Cut 2Dpro
 * ۱۹۲۰×۱۰۸۰ ‏(Full HD افقی) — ۳۰ فریم‌برثانیه — ۴۰ ثانیه
 */
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Promo"
      component={PromoVideo}
      durationInFrames={PROMO_DURATION_FRAMES}
      fps={PROMO_FPS}
      width={1920}
      height={1080}
    />
  );
};
