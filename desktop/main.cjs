const { app, BrowserWindow, Menu, protocol, net, shell, dialog } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { autoUpdater } = require('electron-updater');

/**
 * A-Cut 2Dpro — نسخهٔ ویندوز (Electron)
 * =====================================
 * بستهٔ وب ساخته‌شده (`web/`) از یک پروتکل اختصاصی `app://` سرو می‌شود؛
 * به این ترتیب صفحه یک Origin امن دارد و IndexedDB/Dexie (پروژه‌ها،
 * پیش‌نویس‌ها) و localStorage درست کار می‌کنند. بارگذاری مستقیم با
 * `file://` در برخی نسخه‌های کرومیوم IndexedDB را محدود می‌کند.
 *
 * ساختار پکیج:
 *   main.cjs        این فایل
 *   web/            خروجی `npm run build:app` (کپی‌شده توسط prepare.mjs)
 */

const WEB_DIR = path.join(__dirname, 'web');
const APP_ORIGIN = 'app://acut';

// باید قبل از ready ثبت شود تا app:// به‌عنوان Origin امن شناخته شود
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

/** مسیر امن داخل web/ (جلوگیری از خروج با ../) */
function resolveFile(pathname) {
  const relative = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html';
  const filePath = path.normalize(path.join(WEB_DIR, relative));
  if (!filePath.startsWith(WEB_DIR + path.sep) && filePath !== WEB_DIR) return null;
  return filePath;
}

function registerAppProtocol() {
  protocol.handle('app', async (request) => {
    const { pathname } = new URL(request.url);
    const filePath = resolveFile(pathname) ?? resolveFile('/index.html');
    if (!filePath) return new Response('Not found', { status: 404 });
    try {
      return await net.fetch(pathToFileURL(filePath).toString());
    } catch {
      // مسیر ناموجود (مثلاً مسیرهای SPA) → صفحهٔ اصلی
      return net.fetch(pathToFileURL(path.join(WEB_DIR, 'index.html')).toString());
    }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#e2e8f0',
    title: 'A-Cut 2Dpro',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      // اپ کاملاً سمت کلاینت است؛ دسترسی Node لازم نیست
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  win.loadURL(`${APP_ORIGIN}/index.html`);

  // لینک‌های بیرونی (مثل فونت گوگل یا مستندات) در مرورگر سیستم باز شوند
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(APP_ORIGIN)) {
      event.preventDefault();
      if (url.startsWith('http://') || url.startsWith('https://')) shell.openExternal(url);
    }
  });
}

/**
 * بروزرسانی خودکار نسخهٔ ویندوز (electron-updater + GitHub Releases)
 * =================================================================
 * تنظیمات انتشار (مخزن gase99/Webxplusx) هنگام بیلد توسط electron-builder
 * داخل `resources/app-update.yml` نوشته می‌شود؛ `autoUpdater` از همان‌جا
 * می‌خواند و در آخرین Release منتشرشدهٔ گیت‌هاب دنبال `latest.yml` می‌گردد.
 *
 * رفتار:
 * - هنگام اجرا (و سپس هر ۴ ساعت) وجود نسخهٔ جدید بی‌صدا بررسی می‌شود؛
 * - اگر نسخهٔ جدیدی باشد، در پس‌زمینه دانلود می‌شود (با قابلیت آپدیت
 *   تفاضلی/blockmap فقط بخش‌های تغییرکرده دانلود می‌شوند)؛
 * - بعد از دانلود، از کاربر پرسیده می‌شود «برای نصب ری‌استارت شود؟»؛
 * - اگر «بعداً» را بزند، نسخهٔ جدید با بستن برنامه خودکار نصب می‌شود
 *   (`autoInstallOnAppQuit`).
 *
 * در حالت توسعه (`npm start` بدون پکیج) فایل app-update.yml وجود ندارد و
 * electron-updater خطا می‌دهد؛ پس فقط در نسخهٔ پکیج‌شده فعال است.
 */
const UPDATER_LOG_PREFIX = '[auto-updater]';
const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // هر ۴ ساعت

async function handleUpdateDownloaded(info) {
  console.info(UPDATER_LOG_PREFIX, 'نسخهٔ جدید دانلود شد:', info?.version);
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  const options = {
    type: 'info',
    title: 'بروزرسانی A-Cut 2Dpro',
    message: `نسخهٔ جدید A-Cut 2Dpro (${info?.version ?? ''}) دانلود شد. برای نصب، برنامه ری‌استارت شود؟`,
    detail:
      'اگر «بعداً» را انتخاب کنید، نسخهٔ جدید هنگام بستن برنامه به‌صورت خودکار نصب می‌شود. پروژه‌ها و تنظیمات شما حفظ می‌شوند.',
    buttons: ['ری‌استارت و نصب', 'بعداً'],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  };
  const { response } = win
    ? await dialog.showMessageBox(win, options)
    : await dialog.showMessageBox(options);
  if (response === 0) {
    // بستن برنامه و نصب نسخهٔ جدید (سپس اجرای دوبارهٔ خودکار)
    setImmediate(() => autoUpdater.quitAndInstall());
  }
}

function checkForUpdates() {
  if (!app.isPackaged) {
    console.info(UPDATER_LOG_PREFIX, 'حالت توسعه است؛ بررسی بروزرسانی رد شد.');
    return;
  }

  autoUpdater.autoDownload = true; // دانلود در پس‌زمینه به‌محض یافتن نسخهٔ جدید
  autoUpdater.autoInstallOnAppQuit = true; // «بعداً» یعنی در بستن بعدی نصب کن
  autoUpdater.allowPrerelease = false;
  autoUpdater.logger = {
    info: (...args) => console.info(UPDATER_LOG_PREFIX, ...args),
    warn: (...args) => console.warn(UPDATER_LOG_PREFIX, ...args),
    error: (...args) => console.error(UPDATER_LOG_PREFIX, ...args),
    debug: () => {},
  };

  autoUpdater.on('update-available', (info) =>
    console.info(UPDATER_LOG_PREFIX, 'نسخهٔ جدید یافت شد، در حال دانلود:', info?.version),
  );
  autoUpdater.on('update-not-available', () =>
    console.info(UPDATER_LOG_PREFIX, 'نسخهٔ نصب‌شده به‌روز است.'),
  );
  autoUpdater.on('download-progress', (progress) =>
    console.info(
      UPDATER_LOG_PREFIX,
      `پیشرفت دانلود: ${Math.round(progress.percent)}٪ (${Math.round(progress.transferred / 1024)} از ${Math.round(progress.total / 1024)} کیلوبایت)`,
    ),
  );
  autoUpdater.on('update-downloaded', (info) => {
    void handleUpdateDownloaded(info);
  });
  autoUpdater.on('error', (error) => {
    // خطای شبکه/آفلاین بودن کاربر نباید جریان کار را مختل کند؛ فقط لاگ می‌شود
    console.error(UPDATER_LOG_PREFIX, 'خطا در بررسی بروزرسانی:', error?.message ?? error);
  });

  const runCheck = () => {
    autoUpdater.checkForUpdates().catch((error) => {
      console.error(UPDATER_LOG_PREFIX, 'بررسی بروزرسانی ناموفق بود:', error?.message ?? error);
    });
  };

  // کمی بعد از بالا آمدن پنجره چک می‌کنیم تا روی سرعت اجرا اثر نگذارد،
  // و بعد هر ۴ ساعت برای اجراهای طولانی تکرار می‌شود.
  setTimeout(runCheck, 5_000);
  setInterval(runCheck, UPDATE_CHECK_INTERVAL_MS);
}

app.setAppUserModelId('com.acut.cut2dpro');

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerAppProtocol();
  createWindow();
  checkForUpdates();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
