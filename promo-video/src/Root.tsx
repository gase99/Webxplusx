import React from 'react';
import { Composition } from 'remotion';
import { PromoVideo, PROMO_FPS, PROMO_DURATION_FRAMES, VOICED_DURATION_FRAMES } from './Promo';

/**
 * دو خروجی از یک تایم‌لاین:
 *  - Promo: نسخهٔ بی‌صدا، دقیقاً ۴۰ ثانیه
 *  - PromoVoiced: همان صحنه‌ها با گویندگی فارسی؛ مدت هر صحنه به اندازهٔ
 *    جملهٔ گوینده کشیده شده تا صدا بریده نشود (کمی طولانی‌تر از ۴۰ ثانیه)
 * هر دو ۱۹۲۰×۱۰۸۰ ‏(Full HD افقی) و ۳۰ فریم‌برثانیه‌اند.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Promo"
        component={PromoVideo}
        durationInFrames={PROMO_DURATION_FRAMES}
        fps={PROMO_FPS}
        width={1920}
        height={1080}
        defaultProps={{ voiced: false }}
      />
      <Composition
        id="PromoVoiced"
        component={PromoVideo}
        durationInFrames={VOICED_DURATION_FRAMES}
        fps={PROMO_FPS}
        width={1920}
        height={1080}
        defaultProps={{ voiced: true }}
      />
    </>
  );
};
