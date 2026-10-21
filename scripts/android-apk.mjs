/**
 * ساخت APK/AAB اندروید از خط فرمان (بدون باز کردن Android Studio)
 * -----------------------------------------------------------------
 * پیش‌نیاز: JDK 21 و Android SDK (پوشهٔ android/local.properties یا
 * متغیر محیطی ANDROID_HOME). Gradle Wrapper خودش Gradle را می‌آورد.
 *
 * مثال:
 *   node scripts/android-apk.mjs assembleDebug   → app-debug.apk
 *   node scripts/android-apk.mjs assembleRelease  → app-release-unsigned.apk (نیازمند امضا)
 *   node scripts/android-apk.mjs bundleRelease    → app-release.aab (برای Google Play)
 */
import { spawnSync } from 'node:child_process';
import { platform } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = platform() === 'win32';
const gradle = isWindows ? 'gradlew.bat' : './gradlew';
const task = process.argv[2] ?? 'assembleDebug';

console.log(`▶ اجرای Gradle: ${task} (پوشهٔ android)`);

const result = spawnSync(gradle, [task], {
  cwd: path.join(root, 'android'),
  stdio: 'inherit',
  shell: isWindows,
  env: {
    ...process.env,
    // مسیر JDK در صورت نیاز: JAVA_HOME را در محیط تنظیم کنید
  },
});

if (result.error) {
  console.error('✖ اجرای Gradle ناموفق بود:', result.error.message);
  console.error('  JDK 21 و Android SDK را نصب و ANDROID_HOME را تنظیم کنید.');
  process.exit(1);
}

if (result.status === 0) {
  console.log('\n✔ ساخت با موفقیت انجام شد. خروجی‌ها:');
  console.log('  android/app/build/outputs/apk/debug/app-debug.apk');
  console.log('  android/app/build/outputs/apk/release/app-release-unsigned.apk');
  console.log('  android/app/build/outputs/bundle/release/app-release.aab');
}
process.exit(result.status ?? 1);
