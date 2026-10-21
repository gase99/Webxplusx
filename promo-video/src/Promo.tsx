import React from 'react';
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from 'remotion';
import { Backdrop } from './components/Backdrop';
import { FONT_FAMILY, useVazirmatn } from './lib/font';
import { Scene1Intro } from './scenes/Scene1Intro';
import { Scene2DataEntry } from './scenes/Scene2DataEntry';
import { Scene3Calculate } from './scenes/Scene3Calculate';
import { Scene4CuttingMap } from './scenes/Scene4CuttingMap';
import { Scene5Outputs } from './scenes/Scene5Outputs';
import { Scene6Platforms } from './scenes/Scene6Platforms';
import { Scene7Outro } from './scenes/Scene7Outro';

export const PROMO_FPS = 30;

/**
 * تایم‌لاین ویدیو (فریم @۳۰fps) — مجموع ۱۲٠٠ فریم = ۴۰ ثانیه:
 *  ۱) معرفی ۵s ‏| ۲) ورود داده ۶s ‏| ۳) محاسبه ۷s ‏| ۴) نقشه برش ۷s
 *  ۵) خروجی‌ها ۶s ‏| ۶) پلتفرم‌ها ۵s ‏| ۷) پایان ۴s
 */
const SCENE_DURATIONS = [150, 180, 210, 210, 180, 150, 120] as const;
export const PROMO_DURATION_FRAMES = SCENE_DURATIONS.reduce((a, b) => a + b, 0);

const SCENES: React.FC[] = [
  Scene1Intro,
  Scene2DataEntry,
  Scene3Calculate,
  Scene4CuttingMap,
  Scene5Outputs,
  Scene6Platforms,
  Scene7Outro,
];

const FADE_FRAMES = 12;

/** محو نرم ورود/خروج هر صحنه (آخرین صحنه محو خروجی ندارد تا قاب پایانی بماند) */
const FadedScene: React.FC<{ duration: number; isLast: boolean; children: React.ReactNode }> = ({
  duration,
  isLast,
  children,
}) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, FADE_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeOut = isLast
    ? 1
    : interpolate(frame, [duration - FADE_FRAMES, duration], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
  return <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut) }}>{children}</AbsoluteFill>;
};

export const PromoVideo: React.FC = () => {
  useVazirmatn();

  let cursor = 0;
  const sequences = SCENES.map((Scene, i) => {
    const duration = SCENE_DURATIONS[i];
    const from = cursor;
    cursor += duration;
    return (
      <Sequence key={i} from={from} durationInFrames={duration}>
        <FadedScene duration={duration} isLast={i === SCENES.length - 1}>
          <Scene />
        </FadedScene>
      </Sequence>
    );
  });

  return (
    <AbsoluteFill dir="rtl" style={{ fontFamily: FONT_FAMILY }}>
      <Backdrop />
      {sequences}
    </AbsoluteFill>
  );
};
