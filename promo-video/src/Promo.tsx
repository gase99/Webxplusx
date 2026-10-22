import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
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
 * تایم‌لاین نسخهٔ بی‌صدا (فریم @۳۰fps) — مجموع ۱۲٠٠ فریم = ۴۰ ثانیه:
 *  ۱) معرفی ۵s ‏| ۲) ورود داده ۶s ‏| ۳) محاسبه ۷s ‏| ۴) نقشه برش ۷s
 *  ۵) خروجی‌ها ۶s ‏| ۶) پلتفرم‌ها ۵s ‏| ۷) پایان ۴s
 */
const SCENE_DURATIONS = [150, 180, 210, 210, 180, 150, 120] as const;
export const PROMO_DURATION_FRAMES = SCENE_DURATIONS.reduce((a, b) => a + b, 0);

/**
 * نسخهٔ صدادار (PromoVoiced): گوینده جملهٔ هر صحنه را آرام‌تر از اسلات
 * ۴۰ ثانیه‌ای می‌خواند؛ پس مدت هر صحنه از روی مدت واقعی فایل صدا حساب
 * می‌شود تا جمله دقیقاً داخل همان صحنه جا شود و بریده نشود.
 *
 * AUDIO_SECONDS = مدت اندازه‌گیری‌شدهٔ هر فایل در public/voice/scene*.mp3
 * (صحنه‌های ۴ تا ۶ فعلاً تخمینی‌اند و بعد از تولید صدا با عدد واقعی
 *  جایگزین می‌شوند). صدا با نرخ ۱٫۲ پخش می‌شود تا ریتم تبلیغاتی بگیرد
 *  (زیر و بمی صدا حفظ می‌شود).
 */
const VOICE_RATE = 1.2;
const VOICE_OFFSET_FRAMES = 8; // شروع صدا، چند فریم بعد از ورود صحنه
const VOICE_TAIL_FRAMES = 16; // نفس پایانی صحنه بعد از تمام‌شدن جمله
const AUDIO_SECONDS = [7.24, 9.3, 6.61, 9.04, 9.12, 8.1, 6.35] as const;

const voicedDuration = (sceneIndex: number): number => {
  const needed = Math.ceil(
    VOICE_OFFSET_FRAMES + (AUDIO_SECONDS[sceneIndex] / VOICE_RATE) * PROMO_FPS + VOICE_TAIL_FRAMES,
  );
  // صحنه کوتاه‌تر از نسخهٔ بی‌صدا نشود تا انیمیشن‌های داخلی‌اش کامل شوند
  return Math.max(SCENE_DURATIONS[sceneIndex], needed);
};

export const VOICED_SCENE_DURATIONS = SCENE_DURATIONS.map((_, i) => voicedDuration(i));
export const VOICED_DURATION_FRAMES = VOICED_SCENE_DURATIONS.reduce((a, b) => a + b, 0);

const SCENES: React.FC<{ stretch?: number }>[] = [
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

export interface PromoVideoProps {
  /** true: نسخهٔ صدادار با تایم‌لاین کشیده‌شده بر اساس مدت گویندگی هر صحنه */
  voiced?: boolean;
}

export const PromoVideo: React.FC<PromoVideoProps> = ({ voiced = false }) => {
  useVazirmatn();

  const durations: readonly number[] = voiced ? VOICED_SCENE_DURATIONS : SCENE_DURATIONS;

  let cursor = 0;
  const sequences = SCENES.map((Scene, i) => {
    const duration = durations[i];
    const from = cursor;
    cursor += duration;
    return (
      <Sequence key={i} from={from} durationInFrames={duration}>
        <FadedScene duration={duration} isLast={i === SCENES.length - 1}>
          {/* stretch: انیمیشن داخلی صحنهٔ ورود داده (۲) متناسب با صحنهٔ کشیده‌شده کند می‌شود */}
          <Scene stretch={duration / SCENE_DURATIONS[i]} />
        </FadedScene>
        {voiced && (
          <Sequence from={VOICE_OFFSET_FRAMES} durationInFrames={duration - VOICE_OFFSET_FRAMES}>
            <Audio src={staticFile(`voice/scene${i + 1}.mp3`)} playbackRate={VOICE_RATE} />
          </Sequence>
        )}
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
