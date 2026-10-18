/**
 * A-Cut 2Dpro — موتور بهینه‌سازی برش (فاز ۲)
 * ==========================================
 * الگوریتم چیدمان گیلوتینی (Guillotine Bin Packing) — منطق محاسباتیِ خالص،
 * بدون هیچ وابستگی به React یا DOM تا در فازهای بعدی (رندر نقشهٔ برش در فاز ۳،
 * تست واحد، اجرای سمت سرور و…) قابل‌استفادهٔ مجدد باشد.
 *
 * چرا گیلوتینی؟
 *  در کارگاه واقعی، ارهٔ پانل‌بُر فقط برش مستقیم از یک لبه تا لبهٔ مقابل می‌زند.
 *  این الگوریتم فضای آزاد هر صفحه را به‌صورت مستطیل‌هایی نگه می‌دارد که با هر
 *  جایگذاری، با یک برش گیلوتینی (سرتاسری) به دو مستطیل کوچک‌تر تقسیم می‌شوند؛
 *  پس هر چیدمانی که تولید می‌کند عملاً با اره قابل‌اجراست.
 *
 * دستگاه مختصات:
 *  - مبدأ (0,0) گوشهٔ شروع صفحهٔ خام است.
 *  - محور X در جهت «طول» صفحه و محور Y در جهت «عرض» صفحه (هر دو میلی‌متر).
 *  - در خروجی، `width` اندازهٔ قطعه روی محور X و `height` اندازه روی محور Y است
 *    (با احتساب چرخش) — دقیقاً همان چیزی که فاز ۳ برای رسم روی نقشه لازم دارد.
 *
 * مدل ضخامت تیغه (Kerf):
 *  تیغه هنگام برش، از سمت قطعهٔ باقی‌مانده (پرت/ادامهٔ صفحه) خورده می‌شود، نه از
 *  خود قطعه. پس قطعه ابعاد دقیق خودش را حفظ می‌کند و فضای اشغال‌شده از مستطیل
 *  آزاد برابر است با «ابعاد قطعه + kerf» در هر جهتی که بعد از قطعه فضایی بماند
 *  (اگر قطعه بچسبد به لبهٔ صفحه، آن سمت kerf لازم ندارد). به این ترتیب بین دو
 *  قطعهٔ مجاور همیشه حداقل به‌اندازهٔ ضخامت تیغه فاصله می‌افتد.
 *
 * هیوریستیک‌ها:
 *  1) مرتب‌سازی نزولی قطعات بر اساس مساحت (و در تساوی، بُعد بزرگ‌تر) — قطعات
 *     بزرگ اول چیده می‌شوند.
 *  2) انتخاب مستطیل آزاد با «بهترین برازش مساحت» (Best Area Fit) و در تساوی
 *     «بهترین برازش ضلع کوتاه» (Best Short Side Fit)؛ هر دو جهت عادی و
 *     چرخیدهٔ ۹۰ درجه (در صورت مجاز بودن) امتحان می‌شوند و بهترین برنده است.
 *  3) تقسیم گیلوتینی در راستای باقی‌ماندهٔ بزرگ‌تر تا فضای پیوستهٔ بزرگ‌تری
 *     برای قطعات بعدی بماند، به‌همراه ادغام مستطیل‌های آزاد مجاور (Rect Merge).
 *
 * توجه: مثل همهٔ موتورهای Nesting تجاری، خروجی هیوریستیک است و بهینگیِ
 * ریاضیِ مطلق تضمین نمی‌شود، اما برای ابعاد کارگاهی سریع و نزدیک به بهینه است.
 */

/* ------------------------------------------------------------------ */
/*  تایپ‌های ورودی / خروجی                                             */
/* ------------------------------------------------------------------ */

/** حداقل داده‌ای که الگوریتم از هر ردیف قطعه نیاز دارد (CutPart همین را دارد) */
export interface LayoutPartInput {
  id: string;
  name?: string;
  length: number; // mm
  width: number; // mm
  qty: number;
}

/** صفحهٔ خام (Stock) */
export interface StockSheet {
  length: number; // طول صفحه — جهت محور X (mm)
  width: number; // عرض صفحه — جهت محور Y (mm)
}

export interface LayoutOptions {
  /** ضخامت تیغهٔ اره به میلی‌متر (معمولاً ۳ تا ۴) */
  kerf: number;
  /**
   * چرخش ۹۰ درجهٔ قطعات مجاز است؟
   * (در فازهای بعدی با اضافه‌شدن «قفل گرین/رگهٔ چوب» این گزینه به‌ازای هر
   *  قطعه قابل‌تنظیم می‌شود؛ فعلاً سراسری است.)
   */
  allowRotation?: boolean;
}

/** جای یک قطعهٔ چیده‌شده روی یک صفحه — خروجی اصلی الگوریتم (قابل سریالایز به JSON) */
export interface PlacedPart {
  /** شناسهٔ قطعه (همان id ردیف جدول ورود اطلاعات) */
  id: string;
  name?: string;
  /** این قطعه، چندمین نمونه از «تعداد» آن ردیف است؟ (از ۱ شروع می‌شود) */
  instanceIndex: number;
  /** شمارهٔ صفحهٔ خام (از ۰ شروع می‌شود) */
  sheetIndex: number;
  /** مختصات شروع قطعه روی صفحه (mm) — X در جهت طول صفحه */
  x: number;
  /** مختصات شروع قطعه روی صفحه (mm) — Y در جهت عرض صفحه */
  y: number;
  /** اندازهٔ نهایی قطعه روی محور X با احتساب چرخش (mm) */
  width: number;
  /** اندازهٔ نهایی قطعه روی محور Y با احتساب چرخش (mm) */
  height: number;
  /** آیا قطعه ۹۰ درجه چرخیده است؟ (طول و عرضش جابه‌جا شده) */
  isRotated: boolean;
}

export interface SheetLayout {
  sheetIndex: number;
  placements: PlacedPart[];
  usedArea: number; // mm² — جمع مساحت خود قطعات
  wasteArea: number; // mm² — شامل خوراک تیغه (kerf) هم می‌شود
  utilizationPercentage: number; // ۰ تا ۱۰۰
  wastePercentage: number; // ۰ تا ۱۰۰
}

export interface UnplacedPart {
  id: string;
  name?: string;
  instanceIndex: number;
  length: number;
  width: number;
  /** در حال حاضر تنها دلیل ممکن: قطعه در هیچ جهتی داخل صفحهٔ خام جا نمی‌شود */
  reason: 'LARGER_THAN_SHEET';
}

export interface LayoutSummary {
  /** تعداد صفحات خام مصرفی */
  sheetCount: number;
  /** کل نمونه‌های درخواستی (جمع تعداد همهٔ ردیف‌های معتبر) */
  totalParts: number;
  placedCount: number;
  unplacedCount: number;
  stockAreaPerSheet: number; // mm²
  totalSheetArea: number; // mm²
  usedArea: number; // mm²
  wasteArea: number; // mm²
  /** درصد بهره‌وری کل (۰ تا ۱۰۰) */
  utilizationPercentage: number;
  /** درصد پرت کل (۰ تا ۱۰۰) — خوراک تیغه جزو پرت حساب شده است */
  wastePercentage: number;
}

export interface LayoutResult {
  stock: StockSheet;
  kerf: number;
  allowRotation: boolean;
  /** چیدمان هر صفحه به‌تفکیک */
  sheets: SheetLayout[];
  /** فهرست تختِ همهٔ قطعات چیده‌شده (مناسب مصرف مستقیم فاز ۳) */
  placements: PlacedPart[];
  /** قطعاتی که در هیچ صفحه‌ای جا نشدند */
  unplaced: UnplacedPart[];
  summary: LayoutSummary;
}

/* ------------------------------------------------------------------ */
/*  ساختارهای داخلی الگوریتم                                           */
/* ------------------------------------------------------------------ */

/** مستطیل آزاد روی یک صفحه (width روی X و height روی Y) */
interface FreeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** یک نمونهٔ منفرد از قطعه بعد از بازکردن تعداد (qty) */
interface PartInstance {
  id: string;
  name?: string;
  instanceIndex: number;
  length: number;
  width: number;
  area: number;
  maxDimension: number;
  originalOrder: number;
}

interface WorkingSheet {
  sheetIndex: number;
  freeRects: FreeRect[];
  placements: PlacedPart[];
  usedArea: number;
}

interface PlacementCandidate {
  sheet: WorkingSheet;
  freeRectIndex: number;
  /** ابعاد قطعه در جهت انتخاب‌شده: w روی X و h روی Y */
  w: number;
  h: number;
  isRotated: boolean;
  areaLeftover: number;
  shortSideLeftover: number;
  longSideLeftover: number;
}

const EPS = 1e-9;

/** گردکردن تا ۲ رقم اعشار تا مختصات JSON تمیز بماند (مثلاً 124.50000001 نشود) */
const round2 = (n: number): number => Math.round(n * 100) / 100;

/* ------------------------------------------------------------------ */
/*  توابع کمکی گیلوتینی                                                */
/* ------------------------------------------------------------------ */

/**
 * تقسیم گیلوتینی یک مستطیل آزاد بعد از نشستن قطعه در گوشهٔ (x, y) آن.
 * `occupiedW/H` فضای مصرف‌شده از مستطیل آزاد است (قطعه + kerf در جهت‌هایی که
 * بعدش فضا می‌ماند). برش سرتاسری طوری انتخاب می‌شود که باقی‌ماندهٔ بزرگ‌تر،
 * مستطیل پیوسته‌تری بگیرد.
 *
 * نکتهٔ مهم kerf: مستطیلِ «زیرِ قطعه» فقط به عرض خود قطعه (`partW`) ساخته
 * می‌شود، نه به عرض فضای اشغالی؛ چون نوار خوراک تیغه در تمام طول خط برش
 * گیلوتینی ادامه دارد. اگر این نوار را به مستطیل زیر قطعه می‌دادیم، قطعهٔ
 * بعدیِ آنجا می‌توانست بدون فاصلهٔ تیغه به قطعهٔ ستون کناری بچسبد.
 * (همین قاعده به‌صورت قرینه برای مستطیل «کنار قطعه» با `partH` برقرار است.)
 */
function splitFreeRect(
  free: FreeRect,
  partW: number,
  partH: number,
  occupiedW: number,
  occupiedH: number,
): FreeRect[] {
  const leftoverW = free.width - occupiedW;
  const leftoverH = free.height - occupiedH;
  const result: FreeRect[] = [];

  if (leftoverW >= leftoverH) {
    // برش عمودی سرتاسری: نوار راست با ارتفاع کامل + تکهٔ زیر قطعه (به عرض خود قطعه)
    if (leftoverW > EPS) {
      result.push({
        x: round2(free.x + occupiedW),
        y: free.y,
        width: round2(leftoverW),
        height: free.height,
      });
    }
    if (leftoverH > EPS) {
      result.push({
        x: free.x,
        y: round2(free.y + occupiedH),
        width: round2(partW),
        height: round2(leftoverH),
      });
    }
  } else {
    // برش افقی سرتاسری: نوار پایین با عرض کامل + تکهٔ کنار قطعه (به ارتفاع خود قطعه)
    if (leftoverH > EPS) {
      result.push({
        x: free.x,
        y: round2(free.y + occupiedH),
        width: free.width,
        height: round2(leftoverH),
      });
    }
    if (leftoverW > EPS) {
      result.push({
        x: round2(free.x + occupiedW),
        y: free.y,
        width: round2(leftoverW),
        height: round2(partH),
      });
    }
  }

  return result;
}

/** ادغام مستطیل‌های آزادی که ضلع مشترکِ کامل دارند (Guillotine Rect Merge) */
function mergeFreeRects(rects: FreeRect[]): FreeRect[] {
  const list = [...rects];
  let mergedSomething = true;

  while (mergedSomething) {
    mergedSomething = false;
    outer: for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];

        // روی هم در راستای Y (x و width برابر و چسبیده در جهت عمودی)
        if (a.x === b.x && a.width === b.width) {
          if (round2(a.y + a.height) === b.y || round2(b.y + b.height) === a.y) {
            const y = Math.min(a.y, b.y);
            list.splice(j, 1);
            list[i] = { x: a.x, y, width: a.width, height: round2(a.height + b.height) };
            mergedSomething = true;
            break outer;
          }
        }

        // کنار هم در راستای X (y و height برابر و چسبیده در جهت افقی)
        if (a.y === b.y && a.height === b.height) {
          if (round2(a.x + a.width) === b.x || round2(b.x + b.width) === a.x) {
            const x = Math.min(a.x, b.x);
            list.splice(j, 1);
            list[i] = { x, y: a.y, width: round2(a.width + b.width), height: a.height };
            mergedSomething = true;
            break outer;
          }
        }
      }
    }
  }

  // حذف مستطیل‌هایی که کامل داخل دیگری افتاده‌اند (محض احتیاط)
  return list.filter(
    (r, i) =>
      !list.some(
        (other, j) =>
          j !== i &&
          r.x >= other.x &&
          r.y >= other.y &&
          r.x + r.width <= other.x + other.width + EPS &&
          r.y + r.height <= other.y + other.height + EPS,
      ),
  );
}

/** بهترین جای ممکن برای یک نمونه روی همهٔ صفحه‌های باز (هر دو جهت مجاز) */
function findBestPlacement(
  sheets: WorkingSheet[],
  instance: PartInstance,
  allowRotation: boolean,
): PlacementCandidate | null {
  const orientations = [
    { w: instance.length, h: instance.width, isRotated: false },
    ...(allowRotation && instance.length !== instance.width
      ? [{ w: instance.width, h: instance.length, isRotated: true }]
      : []),
  ];

  let best: PlacementCandidate | null = null;

  for (const sheet of sheets) {
    sheet.freeRects.forEach((free, freeRectIndex) => {
      for (const o of orientations) {
        if (o.w > free.width + EPS || o.h > free.height + EPS) continue;

        const candidate: PlacementCandidate = {
          sheet,
          freeRectIndex,
          w: o.w,
          h: o.h,
          isRotated: o.isRotated,
          areaLeftover: free.width * free.height - o.w * o.h,
          shortSideLeftover: Math.min(free.width - o.w, free.height - o.h),
          longSideLeftover: Math.max(free.width - o.w, free.height - o.h),
        };

        if (
          !best ||
          candidate.areaLeftover < best.areaLeftover - EPS ||
          (Math.abs(candidate.areaLeftover - best.areaLeftover) <= EPS &&
            (candidate.shortSideLeftover < best.shortSideLeftover - EPS ||
              (Math.abs(candidate.shortSideLeftover - best.shortSideLeftover) <= EPS &&
                (candidate.longSideLeftover < best.longSideLeftover - EPS ||
                  (Math.abs(candidate.longSideLeftover - best.longSideLeftover) <= EPS &&
                    !candidate.isRotated &&
                    best.isRotated)))))
        ) {
          best = candidate;
        }
      }
    });
  }

  return best;
}

/** اعمال یک جایگذاری روی صفحه: مصرف مستطیل آزاد + خوراک تیغه + تقسیم و ادغام */
function applyPlacement(
  candidate: PlacementCandidate,
  instance: PartInstance,
  kerf: number,
): PlacedPart {
  const { sheet } = candidate;
  const free = sheet.freeRects[candidate.freeRectIndex];

  const placed: PlacedPart = {
    id: instance.id,
    name: instance.name,
    instanceIndex: instance.instanceIndex,
    sheetIndex: sheet.sheetIndex,
    x: round2(free.x),
    y: round2(free.y),
    width: candidate.w,
    height: candidate.h,
    isRotated: candidate.isRotated,
  };

  // خوراک تیغه فقط در جهتی گرفته می‌شود که بعد از قطعه هنوز فضا مانده باشد؛
  // چسبیده به لبهٔ نهایی ⇒ kerf لازم نیست. اگر باقی‌مانده از kerf کوچک‌تر بود
  // کل باقی‌مانده خوراک تیغه می‌شود و عملاً دورریز غیرقابل‌استفاده است.
  const occupiedW = candidate.w < free.width ? Math.min(free.width, candidate.w + kerf) : free.width;
  const occupiedH = candidate.h < free.height ? Math.min(free.height, candidate.h + kerf) : free.height;

  const remainders = splitFreeRect(free, candidate.w, candidate.h, occupiedW, occupiedH);
  sheet.freeRects.splice(candidate.freeRectIndex, 1, ...remainders);
  sheet.freeRects = mergeFreeRects(sheet.freeRects);

  sheet.placements.push(placed);
  sheet.usedArea += candidate.w * candidate.h;
  return placed;
}

/* ------------------------------------------------------------------ */
/*  تابع اصلی الگوریتم                                                  */
/* ------------------------------------------------------------------ */

/**
 * محاسبهٔ چیدمان گیلوتینی قطعات روی صفحات خام.
 *
 * @param parts  ردیف‌های جدول ورود اطلاعات (فقط ردیف‌های با ابعاد کامل لحاظ می‌شوند)
 * @param stock  ابعاد صفحهٔ خام (mm)
 * @param options  kerf (mm) و مجازبودن چرخش ۹۰ درجه
 * @returns  ساختار کامل نتیجه: جای هر قطعه (sheetIndex, x, y, width, height, isRotated)،
 *           قطعات جانشده و خلاصه (تعداد صفحات + درصد پرت/بهره‌وری)
 */
export function calculateLayout(
  parts: LayoutPartInput[],
  stock: StockSheet,
  options: LayoutOptions,
): LayoutResult {
  const kerf = Math.max(0, options.kerf || 0);
  const allowRotation = options.allowRotation ?? true;
  const stockArea = stock.length > 0 && stock.width > 0 ? stock.length * stock.width : 0;

  // ۱) بازکردن تعدادها به نمونه‌های منفرد (فقط ردیف‌های معتبر)
  const instances: PartInstance[] = [];
  let order = 0;
  for (const part of parts) {
    const qty = Math.floor(part.qty);
    if (!(part.length > 0) || !(part.width > 0) || !(qty > 0)) continue;
    for (let i = 1; i <= qty; i++) {
      instances.push({
        id: part.id,
        name: part.name,
        instanceIndex: i,
        length: part.length,
        width: part.width,
        area: part.length * part.width,
        maxDimension: Math.max(part.length, part.width),
        originalOrder: order++,
      });
    }
  }

  // ۲) قطعات بزرگ‌تر اول: مرتب‌سازی نزولی بر اساس مساحت، بعد بزرگ‌ترین بُعد
  instances.sort(
    (a, b) =>
      b.area - a.area ||
      b.maxDimension - a.maxDimension ||
      a.originalOrder - b.originalOrder,
  );

  // ۳) جایگذاری گیلوتینی صفحه‌به‌صفحه
  const sheets: WorkingSheet[] = [];
  const unplaced: UnplacedPart[] = [];

  const openSheet = (): WorkingSheet => {
    const sheet: WorkingSheet = {
      sheetIndex: sheets.length,
      freeRects: [{ x: 0, y: 0, width: stock.length, height: stock.width }],
      placements: [],
      usedArea: 0,
    };
    sheets.push(sheet);
    return sheet;
  };

  for (const instance of instances) {
    let candidate = findBestPlacement(sheets, instance, allowRotation);

    if (!candidate && stockArea > 0) {
      // یک صفحهٔ تازه باز کن و آنجا امتحان کن
      const freshSheet = openSheet();
      candidate = findBestPlacement([freshSheet], instance, allowRotation);
      if (!candidate) {
        // حتی در صفحهٔ خالی هم جا نمی‌شود ⇒ صفحهٔ تازه را پس بگیر و قطعه را رد کن
        sheets.pop();
      }
    }

    if (candidate) {
      applyPlacement(candidate, instance, kerf);
    } else {
      unplaced.push({
        id: instance.id,
        name: instance.name,
        instanceIndex: instance.instanceIndex,
        length: instance.length,
        width: instance.width,
        reason: 'LARGER_THAN_SHEET',
      });
    }
  }

  // ۴) جمع‌بندی: صفحات، فهرست تخت و درصد پرت/بهره‌وری
  const sheetLayouts: SheetLayout[] = sheets.map((sheet) => {
    const wasteArea = Math.max(0, stockArea - sheet.usedArea);
    return {
      sheetIndex: sheet.sheetIndex,
      placements: sheet.placements,
      usedArea: round2(sheet.usedArea),
      wasteArea: round2(wasteArea),
      utilizationPercentage: stockArea > 0 ? round2((sheet.usedArea / stockArea) * 100) : 0,
      wastePercentage: stockArea > 0 ? round2((wasteArea / stockArea) * 100) : 0,
    };
  });

  const placements = sheetLayouts.flatMap((s) => s.placements);
  const usedArea = sheets.reduce((sum, s) => sum + s.usedArea, 0);
  const totalSheetArea = sheets.length * stockArea;
  const wasteArea = Math.max(0, totalSheetArea - usedArea);

  return {
    stock,
    kerf,
    allowRotation,
    sheets: sheetLayouts,
    placements,
    unplaced,
    summary: {
      sheetCount: sheets.length,
      totalParts: instances.length,
      placedCount: placements.length,
      unplacedCount: unplaced.length,
      stockAreaPerSheet: round2(stockArea),
      totalSheetArea: round2(totalSheetArea),
      usedArea: round2(usedArea),
      wasteArea: round2(wasteArea),
      utilizationPercentage: totalSheetArea > 0 ? round2((usedArea / totalSheetArea) * 100) : 0,
      wastePercentage: totalSheetArea > 0 ? round2((wasteArea / totalSheetArea) * 100) : 0,
    },
  };
}
