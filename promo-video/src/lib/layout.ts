/**
 * دادهٔ نمونهٔ چیدمان برای صحنهٔ ۳ (محاسبه) و ۴ (نقشهٔ برش).
 * مختصات روی یک ورق مجازی ۱۰۰۰×۵۰۰ (همان نسبت ورق ۳۶۶۰×۱۸۳۰) است و
 * قطعات دقیقاً کنار هم چیده شده‌اند تا حس الگوریتم گیلوتینی منتقل شود.
 */
export type OpSide = 'top' | 'bottom' | 'left' | 'right';
export type OpLabel = 'نوار' | 'شیار' | 'فارسی ۴۵°';

export interface DemoPart {
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
  dims: string;
  ops: { side: OpSide; label: OpLabel }[];
}

export const SHEET_W = 1000;
export const SHEET_H = 500;

export const DEMO_PARTS: DemoPart[] = [
  {
    x: 0, y: 0, w: 300, h: 215, name: 'بدنهٔ کناری', dims: '720×560',
    ops: [
      { side: 'top', label: 'نوار' },
      { side: 'left', label: 'نوار' },
      { side: 'bottom', label: 'شیار' },
    ],
  },
  {
    x: 306, y: 0, w: 264, h: 215, name: 'سقف و کف', dims: '564×560',
    ops: [
      { side: 'top', label: 'نوار' },
      { side: 'right', label: 'نوار' },
    ],
  },
  {
    x: 576, y: 0, w: 424, h: 130, name: 'درب کابینت', dims: '715×396',
    ops: [
      { side: 'top', label: 'فارسی ۴۵°' },
      { side: 'bottom', label: 'فارسی ۴۵°' },
      { side: 'right', label: 'نوار' },
    ],
  },
  {
    x: 576, y: 136, w: 206, h: 79, name: 'پیشانی', dims: '380×120',
    ops: [{ side: 'bottom', label: 'نوار' }],
  },
  {
    x: 788, y: 136, w: 212, h: 79, name: 'درب کشو', dims: '390×120',
    ops: [{ side: 'top', label: 'نوار' }],
  },
  {
    x: 0, y: 221, w: 264, h: 279, name: 'بدنهٔ کناری', dims: '720×560',
    ops: [
      { side: 'left', label: 'نوار' },
      { side: 'bottom', label: 'نوار' },
      { side: 'right', label: 'شیار' },
    ],
  },
  {
    x: 270, y: 221, w: 300, h: 135, name: 'طبقه', dims: '564×520',
    ops: [{ side: 'top', label: 'نوار' }],
  },
  {
    x: 270, y: 362, w: 300, h: 138, name: 'طبقه', dims: '564×520',
    ops: [{ side: 'bottom', label: 'نوار' }],
  },
  {
    x: 576, y: 221, w: 196, h: 279, name: 'درب بلند', dims: '715×396',
    ops: [
      { side: 'left', label: 'فارسی ۴۵°' },
      { side: 'right', label: 'نوار' },
      { side: 'bottom', label: 'شیار' },
    ],
  },
  {
    x: 778, y: 221, w: 222, h: 160, name: 'درب کابینت', dims: '715×396',
    ops: [
      { side: 'top', label: 'فارسی ۴۵°' },
      { side: 'right', label: 'نوار' },
    ],
  },
];

/** بهره‌وری این چیدمان نمونه (درصد) — از روی مساحت واقعی قطعات */
export const DEMO_UTILIZATION =
  (DEMO_PARTS.reduce((sum, p) => sum + p.w * p.h, 0) / (SHEET_W * SHEET_H)) * 100;
