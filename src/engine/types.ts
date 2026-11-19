/**
 * A-Cut 2Dpro — تایپ‌های مشترک موتور چیدمان چندالگوریتمی
 * =====================================================
 * همهٔ الگوریتم‌ها (گیلوتینی، MaxRects، Skyline، Shelf، بهینه‌ساز) ورودی و
 * خروجی یکسان دارند تا نقشهٔ برش، DXF، PDF، لیبل و ذخیرهٔ پروژه مستقل از
 * الگوریتم انتخاب‌شده کار کنند.
 *
 * قراردادها (مهم برای همهٔ الگوریتم‌ها):
 *  - مبدأ (0,0) گوشهٔ شروع ورق، X در جهت طول و Y در جهت عرض (میلی‌متر).
 *  - `width` اندازهٔ قطعه روی X و `height` اندازه روی Y است (با احتساب چرخش).
 *  - ابعاد قطعه هرگز شامل kerf نیست؛ kerf فقط فاصلهٔ بین قطعات/لبه‌ها است.
 *  - مختصات گرد تا ۲ رقم اعشار ذخیره می‌شود تا JSON و DXF تمیز بماند.
 */

/* ------------------------------------------------------------------ */
/*  ورودی                                                              */
/* ------------------------------------------------------------------ */

/** حداقل داده‌ای که موتور از هر ردیف قطعه نیاز دارد (CutPart همین را دارد) */
export interface LayoutPartInput {
  id: string;
  name?: string;
  length: number; // mm
  width: number; // mm
  qty: number;
  /** لبه‌های نوارشده؛ برای کسر خودکار ضخامت نوار از ابعاد */
  bandLength?: number;
  bandWidth?: number;
}

/** صفحهٔ خام (Stock) */
export interface StockSheet {
  length: number; // طول صفحه — جهت محور X (mm)
  width: number; // عرض صفحه — جهت محور Y (mm)
}

export interface LayoutOptions {
  /** ضخامت تیغهٔ اره به میلی‌متر (معمولاً ۳ تا ۴) */
  kerf: number;
  /** ضخامت نوار لبه (mm)، بر اساس تعداد لبه‌های نوارشده از ابعاد کسر می‌شود */
  bandThickness?: number;
  /** چرخش ۹۰ درجهٔ قطعات مجاز است؟ */
  allowRotation?: boolean;
  /** رنگ ورق خام برای نمایش نقشه (اختیاری — روی محاسبه اثری ندارد) */
  sheetColor?: string;
  /** رنگ نوار/استریپ برای نمایش نقشه (اختیاری — روی محاسبه اثری ندارد) */
  bandColor?: string;
  /**
   * سقف تعداد ورق خام (۰ یا نامشخص = نامحدود). وقتی به سقف برسیم،
   * قطعات باقی‌مانده با دلیل `STOCK_EXHAUSTED` گزارش می‌شوند.
   */
  maxSheets?: number;
  /** تنظیمات مخصوص هر الگوریتم (بذر، تکرار، هیوریستیک، …) */
  algorithm?: AlgorithmSelection;
  /** گزارش پیشرفت برای حالت‌های کند (بهینه‌ساز) */
  onProgress?: (progress: PackingProgress) => void;
  /** اجازهٔ لغو محاسبه (بهینه‌ساز) */
  signal?: { aborted: boolean };
}

export interface PackingProgress {
  /** ۰ تا ۱ */
  ratio: number;
  /** توضیح کوتاه فارسی برای نمایش */
  message: string;
}

/* ------------------------------------------------------------------ */
/*  انتخاب الگوریتم                                                    */
/* ------------------------------------------------------------------ */

/** شناسهٔ الگوریتم انتخاب‌شده */
export type AlgorithmId = 'guillotine' | 'maxrects' | 'skyline' | 'shelf' | 'optimizer';

/** زیرگزینهٔ هر الگوریتم (هیوریستیک/قانون تقسیم) */
export type AlgorithmVariant =
  /* Guillotine */
  | 'shorter-leftover-axis'
  | 'longer-leftover-axis'
  | 'best-short-side-fit'
  | 'best-area-fit'
  /* MaxRects */
  | 'best-area-fit-mr'
  | 'best-long-side-fit'
  | 'bottom-left'
  /* Skyline */
  | 'skyline-bottom-left'
  | 'skyline-min-waste'
  /* Shelf */
  | 'shelf-first-fit'
  | 'shelf-best-fit'
  /* Optimizer */
  | 'sa-maxrects'
  | 'sa-guillotine';

export interface AlgorithmSelection {
  id: AlgorithmId;
  variant: AlgorithmVariant;
  /** تعداد تکرار بهینه‌ساز (فقط حالت optimizer) */
  iterations?: number;
  /** بذر تصادفی بهینه‌ساز (فقط حالت optimizer) — برای بازتولیدپذیری */
  seed?: number;
}

/* ------------------------------------------------------------------ */
/*  خروجی                                                             */
/* ------------------------------------------------------------------ */

/** جای یک قطعهٔ چیده‌شده روی یک صفحه — خروجی مشترک همهٔ الگوریتم‌ها */
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

/** دلیل جای‌نگرفتن یک قطعه */
export type UnplacedReason = 'LARGER_THAN_SHEET' | 'STOCK_EXHAUSTED';

export interface UnplacedPart {
  id: string;
  name?: string;
  instanceIndex: number;
  length: number;
  width: number;
  reason: UnplacedReason;
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

/** معیارهای عملکرد یک اجرا (برای مقایسهٔ الگوریتم‌ها) */
export interface PackingMetrics {
  /** طول کل خط برش (mm) — تخمین بر مبنای محیط قطعات چیده‌شده */
  cutLength: number;
  /** تعداد برش‌های لازم (هر خط برش کاربردی) */
  cutCount: number;
  /** زمان اجرای الگوریتم (میلی‌ثانیه) */
  elapsedMs: number;
  /** شناسهٔ الگوریتم اجراشده */
  algorithm: AlgorithmId;
  variant: AlgorithmVariant;
}

export interface LayoutResult {
  stock: StockSheet;
  kerf: number;
  /** ضخامت نوار مبنای محاسبه (mm) */
  bandThickness: number;
  allowRotation: boolean;
  /** رنگ ورق خام انتخاب‌شده در زمان محاسبه */
  sheetColor?: string;
  /** رنگ نوار/استریپ انتخاب‌شده در زمان محاسبه */
  bandColor?: string;
  /** الگوریتمی که این نتیجه را ساخته (برای نمایش و مقایسه) */
  algorithm: AlgorithmId;
  /** زیرگزینهٔ الگوریتم */
  variant: AlgorithmVariant;
  /** چیدمان هر صفحه به‌تفکیک */
  sheets: SheetLayout[];
  /** فهرست تختِ همهٔ قطعات چیده‌شده (مناسب مصرف مستقیم نقشهٔ برش) */
  placements: PlacedPart[];
  /** قطعاتی که در هیچ صفحه‌ای جا نشدند */
  unplaced: UnplacedPart[];
  summary: LayoutSummary;
  /** معیارهای عملکرد (اختیاری برای سازگاری با پروژه‌های ذخیره‌شدهٔ قدیمی) */
  metrics?: PackingMetrics;
  /** سقف ورق در نظر گرفته‌شده (۰ = نامحدود) */
  maxSheets?: number;
}

/* ------------------------------------------------------------------ */
/*  رابط مشترک همهٔ الگوریتم‌ها                                         */
/* ------------------------------------------------------------------ */

/** یک نمونهٔ منفرد از قطعه بعد از بازکردن تعداد (qty) */
export interface PartInstance {
  id: string;
  name?: string;
  instanceIndex: number;
  length: number;
  width: number;
  area: number;
  maxDimension: number;
  originalOrder: number;
}

/** اطلاعات کامل اجرای الگوریتم که به هر پیاده‌سازی داده می‌شود */
export interface PackingContext {
  /** نمونه‌های منفرد قطعات (بدون ردیف‌های نامعتبر) */
  instances: PartInstance[];
  stock: StockSheet;
  kerf: number;
  allowRotation: boolean;
  /** سقف ورق؛ ۰ = نامحدود */
  maxSheets: number;
  /** تنظیمات الگوریتم (بذر/تکرار/هیوریستیک) */
  selection: AlgorithmSelection;
  onProgress?: (progress: PackingProgress) => void;
  signal?: { aborted: boolean };
}

/** خروجی خام الگوریتم؛ ساخت `LayoutResult` کامل کار هستهٔ مشترک است */
export interface PackingOutcome {
  sheets: SheetLayout[];
  placements: PlacedPart[];
  unplaced: UnplacedPart[];
}

/**
 * رابط مشترک الگوریتم‌های چیدمان.
 * افزودن الگوریتم جدید = پیاده‌سازی همین رابط + ثبت در `registry.ts`.
 */
export interface PackingAlgorithm {
  id: AlgorithmId;
  /** نام فارسی برای نمایش در رابط */
  label: string;
  /** توضیح کوتاه فارسی */
  description: string;
  /** زیرگزینه‌های مجاز این الگوریتم با نام فارسی */
  variants: { value: AlgorithmVariant; label: string }[];
  /** آیا این الگوریتم کند است (نیاز به پیشرفت/لغو دارد)؟ */
  slow?: boolean;
  run(context: PackingContext): PackingOutcome;
}
