const { app, BrowserWindow, Menu, protocol, net, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

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

app.setAppUserModelId('com.acut.cut2dpro');

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerAppProtocol();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
