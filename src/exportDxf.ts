/**
 * A-Cut 2Dpro — خروجی DXF برای CNC (فاز ۴)
 * =======================================
 * تولیدکنندهٔ متنی سبک DXF (نسخهٔ R12 / AC1009) بدون وابستگی خارجی؛
 * R12 تقریباً توسط همهٔ نرم‌افزارهای CAD/CAM و کنترلرهای CNC خوانده می‌شود.
 * واحد فایل میلی‌متر است.
 *
 * لایه‌ها (Layer):
 *  - `SHEET`    (خاکستری) : کادر هر ورق خام
 *  - `CUT`      (سفید)    : مستطیل بستهٔ هر قطعه (خط برش)
 *  - `GROOVE`   (نارنجی)  : خطوط شیار داخل قطعه، موازی لبه و با فاصلهٔ ۱۰mm
 *  - `FARSI_45` (قرمز)    : خط مورب ۴۵ درجه در گوشه‌های لبهٔ فارسی
 *                           (مثلث گوشه = خودِ برش فارسی؛ وترش در این لایه است)
 *  - `LABEL`    (آبی)     : کد قطعه مثل `S1-03` در مرکز آن — همان کدی که روی
 *                           لیبل چاپی قطعه هم می‌آید تا تطبیق آسان باشد.
 * «نوار» عمداً هندسهٔ DXF ندارد: لبه‌چسب عملیات برش CNC نیست و خط اضافی روی
 * لبه می‌توانست به اشتباه ماشین‌کاری شود؛ اطلاعات نوار روی نقشهٔ چاپی و لیبل هست.
 *
 * دستگاه مختصات DXF (Y رو به بالا): مختصات چیدمان (مبدأ گوشهٔ ورق، Y در جهت
 * عرض) به‌صورت آینه‌ای عمودی تبدیل می‌شود تا مبدأ هر ورق در گوشهٔ پایین-چپ
 * آن باشد: `dxfY = stockWidth - y - height`. لبه‌ها (مثلاً شیار لبهٔ بالا)
 * بعد از این تبدیل هم دقیقاً سر جای فیزیکی خودشان می‌مانند.
 * اگر چند ورق داشته باشیم، ورق‌ها با فاصلهٔ ۱۰۰ میلی‌متر کنار هم در جهت X
 * در یک فایل قرار می‌گیرند و بالای هرکدام برچسب `SHEET n` نوشته می‌شود.
 */
import type { LayoutResult } from './algorithm';
import { GROOVE_INSET_MM, getPartEdgeSides, type PartSide } from './partEdges';
import type { CutPart } from './types/part';

/** فاصلهٔ بین ورق‌ها وقتی چند ورق در یک فایل کنار هم قرار می‌گیرند (mm) */
export const DXF_SHEET_GAP_MM = 100;

/** کد یکتای هر قطعهٔ چیده‌شده، مشترک بین DXF و لیبل چاپی: مثل S2-07 */
export function getPlacementCode(sheetIndex: number, indexInSheet: number): string {
  return `S${sheetIndex + 1}-${String(indexInSheet + 1).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/*  سازندهٔ کمینهٔ DXF (R12)                                           */
/* ------------------------------------------------------------------ */

const fmt = (n: number): string => {
  const v = Math.round(n * 1000) / 1000;
  return String(Object.is(v, -0) ? 0 : v);
};

class DxfBuilder {
  private lines: string[] = [];

  pair(code: number, value: string | number): this {
    this.lines.push(String(code), typeof value === 'number' ? fmt(value) : value);
    return this;
  }

  section(name: string, body: () => void): this {
    this.pair(0, 'SECTION').pair(2, name);
    body();
    this.pair(0, 'ENDSEC');
    return this;
  }

  /** مستطیل/چندضلعی بسته با POLYLINE (سازگار با R12) */
  closedPolyline(layer: string, points: [number, number][]): this {
    this.pair(0, 'POLYLINE').pair(8, layer).pair(66, 1).pair(70, 1); // 70=1 ⇒ بسته
    for (const [x, y] of points) {
      this.pair(0, 'VERTEX').pair(8, layer).pair(10, x).pair(20, y).pair(30, 0);
    }
    this.pair(0, 'SEQEND').pair(8, layer);
    return this;
  }

  line(layer: string, x1: number, y1: number, x2: number, y2: number): this {
    this.pair(0, 'LINE')
      .pair(8, layer)
      .pair(10, x1).pair(20, y1).pair(30, 0)
      .pair(11, x2).pair(21, y2).pair(31, 0);
    return this;
  }

  /** متن وسط‌چین (فقط ASCII — کد قطعه و مشخصات ورق؛ نام فارسی در DXF امن نیست) */
  text(layer: string, x: number, y: number, height: number, value: string, rotation = 0): this {
    this.pair(0, 'TEXT')
      .pair(8, layer)
      .pair(10, x).pair(20, y).pair(30, 0)
      .pair(40, height)
      .pair(1, value)
      .pair(50, rotation)
      .pair(72, 1) // وسط افقی
      .pair(11, x).pair(21, y).pair(31, 0)
      .pair(73, 2); // وسط عمودی
    return this;
  }

  build(): string {
    return `${this.lines.join('\n')}\n`;
  }
}

/* ------------------------------------------------------------------ */
/*  تولید فایل DXF از نتیجهٔ چیدمان                                    */
/* ------------------------------------------------------------------ */

const LAYERS: [name: string, aciColor: number][] = [
  ['SHEET', 8], // خاکستری
  ['CUT', 7], // سفید/مشکی
  ['GROOVE', 30], // نارنجی
  ['FARSI_45', 1], // قرمز
  ['LABEL', 5], // آبی
];

export function generateDxf(result: LayoutResult, parts: CutPart[]): string {
  const { stock } = result;
  const partsById = new Map(parts.map((p) => [p.id, p]));
  const dxf = new DxfBuilder();

  dxf.pair(999, 'A-Cut 2Dpro - DXF export - units: mm - origin: bottom-left of each sheet');

  dxf.section('HEADER', () => {
    dxf.pair(9, '$ACADVER').pair(1, 'AC1009'); // R12
  });

  dxf.section('TABLES', () => {
    // نوع خط پایه
    dxf.pair(0, 'TABLE').pair(2, 'LTYPE').pair(70, 1);
    dxf.pair(0, 'LTYPE').pair(2, 'CONTINUOUS').pair(70, 0).pair(3, 'Solid line')
      .pair(72, 65).pair(73, 0).pair(40, 0);
    dxf.pair(0, 'ENDTAB');
    // لایه‌ها
    dxf.pair(0, 'TABLE').pair(2, 'LAYER').pair(70, LAYERS.length);
    for (const [name, color] of LAYERS) {
      dxf.pair(0, 'LAYER').pair(2, name).pair(70, 0).pair(62, color).pair(6, 'CONTINUOUS');
    }
    dxf.pair(0, 'ENDTAB');
    // استایل متن پایه
    dxf.pair(0, 'TABLE').pair(2, 'STYLE').pair(70, 1);
    dxf.pair(0, 'STYLE').pair(2, 'STANDARD').pair(70, 0).pair(40, 0).pair(41, 1)
      .pair(50, 0).pair(71, 0).pair(42, 2.5).pair(3, 'txt').pair(4, '');
    dxf.pair(0, 'ENDTAB');
  });

  dxf.section('BLOCKS', () => {});

  dxf.section('ENTITIES', () => {
    for (const sheet of result.sheets) {
      const offsetX = sheet.sheetIndex * (stock.length + DXF_SHEET_GAP_MM);
      const X = (x: number) => offsetX + x;

      // کادر ورق خام + عنوان آن
      dxf.closedPolyline('SHEET', [
        [offsetX, 0],
        [X(stock.length), 0],
        [X(stock.length), stock.width],
        [offsetX, stock.width],
      ]);
      dxf.text(
        'LABEL',
        X(stock.length / 2),
        stock.width + DXF_SHEET_GAP_MM * 0.35,
        Math.min(45, Math.max(18, stock.width * 0.018)),
        `SHEET ${sheet.sheetIndex + 1} - ${stock.length} x ${stock.width} mm`,
      );

      sheet.placements.forEach((p, indexInSheet) => {
        // تبدیل Y: در DXF مبدأ پایین ورق است
        const y0 = stock.width - p.y - p.height; // لبهٔ پایین مستطیل در DXF
        const y1 = y0 + p.height; // لبهٔ بالای مستطیل در DXF (= لبهٔ top چیدمان)
        const x0 = X(p.x);
        const x1 = X(p.x + p.width);

        // مستطیل بستهٔ قطعه (خط برش)
        dxf.closedPolyline('CUT', [
          [x0, y0],
          [x1, y0],
          [x1, y1],
          [x0, y1],
        ]);

        const source = partsById.get(p.id);
        if (source) {
          const sides = getPartEdgeSides(source, p.isRotated);

          // شیار: خط داخلی موازی لبه با فاصلهٔ ثابت
          const grooveInset = Math.min(GROOVE_INSET_MM, Math.min(p.width, p.height) / 4);
          if (grooveInset > 0) {
            for (const side of sides.groove) {
              if (side === 'top') dxf.line('GROOVE', x0, y1 - grooveInset, x1, y1 - grooveInset);
              if (side === 'bottom') dxf.line('GROOVE', x0, y0 + grooveInset, x1, y0 + grooveInset);
              if (side === 'left') dxf.line('GROOVE', x0 + grooveInset, y0, x0 + grooveInset, y1);
              if (side === 'right') dxf.line('GROOVE', x1 - grooveInset, y0, x1 - grooveInset, y1);
            }
          }

          // فارسی: خط مورب ۴۵° در مثلثِ هر گوشه از لبهٔ فارسی
          const leg = Math.min(30, (Math.min(p.width, p.height) / 2) * 0.9);
          if (leg >= 5 && sides.farsi.length > 0) {
            // گوشه‌های مستطیل در مختصات DXF و خط مورب هرکدام
            const cornerDiagonals: Record<string, [number, number, number, number]> = {
              TL: [x0 + leg, y1, x0, y1 - leg],
              TR: [x1 - leg, y1, x1, y1 - leg],
              BL: [x0 + leg, y0, x0, y0 + leg],
              BR: [x1 - leg, y0, x1, y0 + leg],
            };
            const cornersBySide: Record<PartSide, string[]> = {
              top: ['TL', 'TR'],
              bottom: ['BL', 'BR'],
              left: ['TL', 'BL'],
              right: ['TR', 'BR'],
            };
            const drawn = new Set<string>();
            for (const side of sides.farsi) {
              for (const corner of cornersBySide[side]) {
                if (drawn.has(corner)) continue; // گوشهٔ مشترک دو لبه دوبار رسم نشود
                drawn.add(corner);
                const [ax, ay, bx, by] = cornerDiagonals[corner];
                dxf.line('FARSI_45', ax, ay, bx, by);
              }
            }
          }
        }

        // کد قطعه در مرکز (همان کد روی لیبل چاپی)
        if (Math.min(p.width, p.height) >= 25) {
          dxf.text(
            'LABEL',
            (x0 + x1) / 2,
            (y0 + y1) / 2,
            Math.min(45, Math.max(10, Math.min(p.width, p.height) * 0.14)),
            getPlacementCode(sheet.sheetIndex, indexInSheet),
            p.isRotated && p.height > p.width ? 90 : 0,
          );
        }
      });
    }
  });

  dxf.pair(0, 'EOF');
  return dxf.build();
}

/** ساخت و دانلود فایل DXF در مرورگر */
export function downloadDxf(result: LayoutResult, parts: CutPart[], filename?: string): void {
  const content = generateDxf(result, parts);
  const blob = new Blob([content], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download =
    filename ?? `ACut_${result.stock.length}x${result.stock.width}_${result.summary.sheetCount}sheets.dxf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
