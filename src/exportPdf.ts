/**
 * A-Cut 2Dpro — خروجی PDF (جایگزین چاپ برای موبایل)
 * ==================================================
 * `window.print()` در WebView گوشی (نسخهٔ APK) و PWA نصب‌شده کار نمی‌کند؛
 * روی موبایل (تشخیص در `platform.ts`) همان سندِ Print Portal — با همان
 * استایل و صفحه‌بندی چاپ (هر ورق یک صفحهٔ A4) — به فایل PDF تبدیل می‌شود:
 *  - وب موبایل: دانلود مستقیم فایل
 *  - اپ اندروید: ذخیره با `@capacitor/filesystem` + منوی اشتراک‌گذاری با
 *    `@capacitor/share` تا کاربر آن را ذخیره یا برای چاپ بفرستد.
 *
 * روش رندر — `html-to-image` + `jsPDF` (عمداً نه html2canvas):
 * html2canvas یک موتور رندر جداگانه است که با رنگ‌های `oklch` در
 * Tailwind v4 خطا می‌دهد و CSS Grid را ناقص پشتیبانی می‌کند؛ در عوض
 * html-to-image سند را با همان موتور خودِ مرورگر به تصویر تبدیل می‌کند،
 * پس متن فارسی (با فونت وزیرمتن)، SVG نقشه، برچسب‌های داخل قطعات و هاشورها دقیقاً
 * همان‌طور که روی صفحه/چاپ دیده می‌شوند، با وضوح ۳ برابر (معادل ~۲۸۸dpi)
 * داخل PDF قرار می‌گیرند و خطوط سیاه‌وسفید نقشه کاملاً شارپ می‌مانند.
 *
 * این ماژول از `LayoutPanel` به‌صورت `import()` پویا صدا زده می‌شود تا
 * حجم بستهٔ اصلی هنگام بازشدن برنامه زیاد نشود.
 */
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';

export type PdfDocKind = 'map' | 'labels';

/** ابعاد A4 عمودی (میلی‌متر) */
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

/** چند پیکسل CSS در هر میلی‌متر (96dpi)؛ مبنای تبدیل اندازه‌های mm سند */
const PX_PER_MM = 96 / 25.4;

/** وضوح ضبط سند: ۳ برابر تا خطوط نقشه و متن‌های ریز در PDF تار نشوند */
const PIXEL_RATIO = 3;

/* ------------------------------------------------------------------ */
/*  محاسبات خالص چیدمان در صفحه (بدون DOM — قابل تست)                  */
/* ------------------------------------------------------------------ */

export interface FitSize {
  widthMm: number;
  heightMm: number;
}

/**
 * جا دادن یک تصویر با ابعاد فیزیکی (mm) داخل یک کادر (mm) با حفظ نسبت.
 * با `allowUpscale: false` اندازهٔ واقعی mm حفظ می‌شود (برای لیبل‌ها که
 * باید دقیقاً هم‌اندازهٔ کاغذ برچسبی بمانند) و فقط در صورت بزرگ‌تربودن
 * کوچک می‌شود.
 */
export function fitWithinBox(
  widthMm: number,
  heightMm: number,
  boxWidthMm: number,
  boxHeightMm: number,
  allowUpscale = true,
): FitSize {
  if (widthMm <= 0 || heightMm <= 0) return { widthMm: 0, heightMm: 0 };
  const scale = Math.min(
    boxWidthMm / widthMm,
    boxHeightMm / heightMm,
    allowUpscale ? Number.POSITIVE_INFINITY : 1,
  );
  return { widthMm: widthMm * scale, heightMm: heightMm * scale };
}

export interface CanvasSlice {
  /** شروع برش در بوم اصلی (px) */
  sy: number;
  /** ارتفاع برش (px) */
  sh: number;
}

/**
 * برش‌های عمودی یک بوم بلند برای صفحه‌بندی A4: هر صفحه دقیقاً به ارتفاع
 * ناحیهٔ محتوای A4 برش می‌خورد. کاربرد فعلی: «فهرست قطعات» سند نقشه که
 * اگر از یک صفحه بلندتر شد، چند صفحهٔ انتهایی برمی‌گردد.
 */
export function computeSlices(
  canvasWidthPx: number,
  canvasHeightPx: number,
  contentWidthMm: number,
  contentHeightMm: number,
): CanvasSlice[] {
  if (canvasWidthPx <= 0 || canvasHeightPx <= 0) return [];
  const pageHeightPx = Math.max(1, Math.floor((canvasWidthPx * contentHeightMm) / contentWidthMm));
  const slices: CanvasSlice[] = [];
  for (let sy = 0; sy < canvasHeightPx; sy += pageHeightPx) {
    slices.push({ sy, sh: Math.min(pageHeightPx, canvasHeightPx - sy) });
  }
  return slices;
}

/* ------------------------------------------------------------------ */
/*  ضبط سند و ساخت PDF                                                 */
/* ------------------------------------------------------------------ */

/** رندر یک عنصر DOM به بوم با وضوح بالا و پس‌زمینهٔ سفید */
async function captureElement(element: HTMLElement): Promise<HTMLCanvasElement> {
  return toCanvas(element, { pixelRatio: PIXEL_RATIO, backgroundColor: '#ffffff' });
}

/** بریدن یک ناحیهٔ عمودی از بوم اصلی روی یک بوم موقت با پس‌زمینهٔ سفید */
function sliceCanvas(source: HTMLCanvasElement, sy: number, sh: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, sy, source.width, sh, 0, 0, source.width, sh);
  }
  return canvas;
}

function newA4Pdf(title: string): jsPDF {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  pdf.setProperties({ title, creator: 'A-Cut 2Dpro' });
  return pdf;
}

/**
 * سند نقشه با صفحه‌بندی «تفکیک‌شده» (عینِ چاپ دسکتاپ): هر ورق خام یک
 * صفحهٔ کامل A4 می‌شود تا برچسب‌های داخل قطعات درشت و خوانا بمانند و
 * «فهرست قطعات + فاکتور متریال» در صفحهٔ(های) جدای انتهایی می‌آید.
 * سربرگ سند و عنوان/راهنمای نقشه بالای صفحهٔ ورق اول قرار می‌گیرد.
 * عرض ضبط در CSS برابر ناحیهٔ محتوای A4 با حاشیهٔ ۵mm (۲۰۰mm ‏= ‏756px)
 * است و مقیاس ۱:۱ چاپی است (بدون فشرده‌سازی).
 */
async function buildMapPdf(portal: HTMLElement): Promise<Blob> {
  const docEl = portal.querySelector<HTMLElement>('.print-doc-map') ?? portal;
  const margin = 5;
  const contentWidth = A4_WIDTH_MM - margin * 2; // 200mm
  const contentHeight = A4_HEIGHT_MM - margin * 2; // 287mm

  const headerEl = docEl.querySelector<HTMLElement>(':scope > header');
  const mapSection = docEl.querySelector<HTMLElement>('.print-doc-map-inner') ?? docEl;
  const mapTitleEl = mapSection.querySelector<HTMLElement>(':scope > .cutting-map > div:first-child');
  const sheetEls = Array.from(docEl.querySelectorAll<HTMLElement>('.print-sheet'));
  const partsEl = docEl.querySelector<HTMLElement>('.print-parts-section');

  // سند قدیمی/نامتعارف بدون بلوک‌های ورق: رفتار قبلی (کل سند، برش‌خورده)
  if (sheetEls.length === 0) {
    const canvas = await captureElement(docEl);
    const slices = computeSlices(canvas.width, canvas.height, contentWidth, contentHeight);
    if (slices.length === 0) throw new Error('سند نقشه خالی است');
    const pdf = newA4Pdf('نقشهٔ برش و فهرست قطعات — A-Cut 2Dpro');
    slices.forEach((slice, index) => {
      if (index > 0) pdf.addPage('a4', 'portrait');
      const pageCanvas = slice.sh === canvas.height ? canvas : sliceCanvas(canvas, slice.sy, slice.sh);
      const heightMm = contentWidth * (pageCanvas.height / pageCanvas.width);
      pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', margin, margin, contentWidth, heightMm);
    });
    return pdf.output('blob');
  }

  const pdf = newA4Pdf('نقشهٔ برش و فهرست قطعات — A-Cut 2Dpro');
  let pageStarted = false;

  /** چیدن چند بوم روی هم و نشستن آن‌ها در یک صفحهٔ A4 (بالا، تمام‌عرض) */
  const putStack = (blocks: HTMLCanvasElement[], gapMm: number): void => {
    if (blocks.length === 0) return;
    const width = Math.max(...blocks.map((b) => b.width));
    const gapPx = Math.round(gapMm * PX_PER_MM * PIXEL_RATIO);
    const totalHeight =
      blocks.reduce((sum, b) => sum + b.height, 0) + gapPx * Math.max(0, blocks.length - 1);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = totalHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, totalHeight);
      let y = 0;
      for (const block of blocks) {
        ctx.drawImage(block, Math.round((width - block.width) / 2), y);
        y += block.height + gapPx;
      }
    }
    const naturalWidthMm = width / PIXEL_RATIO / PX_PER_MM;
    const naturalHeightMm = totalHeight / PIXEL_RATIO / PX_PER_MM;
    const fit = fitWithinBox(naturalWidthMm, naturalHeightMm, contentWidth, contentHeight);
    if (pageStarted) pdf.addPage('a4', 'portrait');
    pageStarted = true;
    pdf.addImage(
      canvas.toDataURL('image/png'),
      'PNG',
      (A4_WIDTH_MM - fit.widthMm) / 2,
      margin,
      fit.widthMm,
      fit.heightMm,
    );
  };

  // صفحه‌های ورق: ورق اول همراه سربرگ و راهنما، بقیه فقط خودِ ورق
  const headerCanvas = headerEl ? await captureElement(headerEl) : null;
  const mapTitleCanvas = mapTitleEl ? await captureElement(mapTitleEl) : null;
  for (let index = 0; index < sheetEls.length; index += 1) {
    const sheetCanvas = await captureElement(sheetEls[index]);
    const blocks =
      index === 0
        ? [headerCanvas, mapTitleCanvas, sheetCanvas].filter(
            (b): b is HTMLCanvasElement => b !== null,
          )
        : [sheetCanvas];
    putStack(blocks, 2);
  }

  // فهرست قطعات + فاکتور متریال: صفحهٔ(های) جدای انتهایی، اگر بلند شد برش می‌خورد
  if (partsEl) {
    const canvas = await captureElement(partsEl);
    const slices = computeSlices(canvas.width, canvas.height, contentWidth, contentHeight);
    slices.forEach((slice) => {
      if (pageStarted) pdf.addPage('a4', 'portrait');
      pageStarted = true;
      const pageCanvas = slice.sh === canvas.height ? canvas : sliceCanvas(canvas, slice.sy, slice.sh);
      const heightMm = contentWidth * (pageCanvas.height / pageCanvas.width);
      pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', margin, margin, contentWidth, heightMm);
    });
  }

  if (!pageStarted) throw new Error('سند نقشه خالی است');
  return pdf.output('blob');
}

/**
 * لیبل‌ها → هر `.label-page` دقیقاً یک صفحهٔ A4 با حاشیهٔ ۸mm.
 * اندازه‌ها ۱:۱ واقعی می‌مانند (بدون بزرگ‌نمایی) تا شبکهٔ ۳×۵ روی کاغذ
 * برچسبی هم‌تراز بماند.
 */
async function buildLabelsPdf(portal: HTMLElement): Promise<Blob> {
  const margin = 8;
  const contentWidth = A4_WIDTH_MM - margin * 2; // 194mm
  const contentHeight = A4_HEIGHT_MM - margin * 2; // 281mm
  const pageEls = Array.from(portal.querySelectorAll<HTMLElement>('.label-page'));
  const targets = pageEls.length > 0 ? pageEls : [portal];

  const pdf = newA4Pdf('لیبل قطعات — A-Cut 2Dpro');
  for (let index = 0; index < targets.length; index += 1) {
    const canvas = await captureElement(targets[index]);
    // ابعاد فیزیکی همان چیزی که ضبط شده: px تقسیم بر PIXEL_RATIO، بعد تبدیل به mm
    const physical = {
      widthMm: canvas.width / PIXEL_RATIO / PX_PER_MM,
      heightMm: canvas.height / PIXEL_RATIO / PX_PER_MM,
    };
    const fit = fitWithinBox(physical.widthMm, physical.heightMm, contentWidth, contentHeight, false);
    if (index > 0) pdf.addPage('a4', 'portrait');
    pdf.addImage(
      canvas.toDataURL('image/png'),
      'PNG',
      (A4_WIDTH_MM - fit.widthMm) / 2,
      margin,
      fit.widthMm,
      fit.heightMm,
    );
  }
  return pdf.output('blob');
}

/* ------------------------------------------------------------------ */
/*  تحویل فایل: اشتراک‌گذاری بومی یا دانلود مرورگری                    */
/* ------------------------------------------------------------------ */

export type DeliverOutcome = 'shared' | 'downloaded' | 'cancelled';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('خواندن فایل PDF ناموفق بود'));
    reader.onload = () => resolve(String(reader.result).split(',', 2)[1] ?? '');
    reader.readAsDataURL(blob);
  });
}

function isShareCancelled(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /cancel|abort|dismiss/i.test(message);
}

/** دانلود با تگ `<a download>` — مسیر معمول مرورگرها (هم‌رفتار با DXF) */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // کمی دیرتر revoke شود تا بعضی مرورگرهای موبایل دانلود را از دست ندهند
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * رساندن PDF به دست کاربر:
 * - اپ بومی: فایل روی Cache نوشته و منوی اشتراک‌گذاری سیستم باز می‌شود
 *   (ذخیره در فایل‌ها، ارسال، یا چاپ از همان منو). بستن منو خطا نیست.
 * - وب: دانلود مستقیم فایل در مرورگر.
 */
export async function deliverPdf(blob: Blob, filename: string, title: string): Promise<DeliverOutcome> {
  if (Capacitor.isNativePlatform()) {
    const data = await blobToBase64(blob);
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data,
      directory: Directory.Cache,
      recursive: true,
    });
    try {
      await Share.share({ title, dialogTitle: title, files: [uri] });
      return 'shared';
    } catch (error) {
      if (isShareCancelled(error)) return 'cancelled';
      throw error;
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

/** ساخت PDF از سند داخل Print Portal و تحویل آن به کاربر (دانلود/اشتراک) */
export async function generateAndDeliverPdf(
  portal: HTMLElement,
  kind: PdfDocKind,
  filename: string,
  title: string,
): Promise<DeliverOutcome> {
  const blob = kind === 'map' ? await buildMapPdf(portal) : await buildLabelsPdf(portal);
  return deliverPdf(blob, filename, title);
}
