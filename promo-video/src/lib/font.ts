import { useEffect, useState } from 'react';
import { continueRender, delayRender, staticFile } from 'remotion';

/**
 * بارگذاری فونت وزیرمتن از فایل‌های داخل خود پروژه (public/fonts)
 * تا رندر ویدیو کاملاً آفلاین و مستقل از CDN گوگل انجام شود.
 * رندر تا آماده‌شدن فونت‌ها با delayRender نگه داشته می‌شود.
 */
const FACES: { weight: number; file: string }[] = [
  { weight: 400, file: 'fonts/Vazirmatn-Regular.woff2' },
  { weight: 500, file: 'fonts/Vazirmatn-Medium.woff2' },
  { weight: 600, file: 'fonts/Vazirmatn-SemiBold.woff2' },
  { weight: 700, file: 'fonts/Vazirmatn-Bold.woff2' },
  { weight: 800, file: 'fonts/Vazirmatn-ExtraBold.woff2' },
  { weight: 900, file: 'fonts/Vazirmatn-Black.woff2' },
];

export function useVazirmatn(): void {
  const [handle] = useState(() => delayRender('بارگذاری فونت وزیرمتن'));

  useEffect(() => {
    Promise.all(
      FACES.map(async ({ weight, file }) => {
        const face = new FontFace('Vazirmatn', `url(${staticFile(file)}) format('woff2')`, {
          weight: String(weight),
          style: 'normal',
        });
        await face.load();
        document.fonts.add(face);
      }),
    )
      .then(() => continueRender(handle))
      .catch((err) => {
        // اگر فونت نیامد، رندر با فونت جایگزین ادامه پیدا کند (قفل نشود)
        console.warn('Vazirmatn load failed, continuing with fallback font', err);
        continueRender(handle);
      });
  }, [handle]);
}

export const FONT_FAMILY = "'Vazirmatn', Tahoma, Arial, sans-serif";
