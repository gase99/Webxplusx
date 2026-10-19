#!/usr/bin/env node
/**
 * A-Cut 2Dpro — تولید آیکون‌های PWA (بدون هیچ وابستگیٔ خارجی)
 * ------------------------------------------------------------
 * خروجی: public/icons/*.png
 *   - icon-192.png / icon-512.png            (گوشه‌های گرد، شفاف)
 *   - icon-maskable-192.png / icon-maskable-512.png (پرمقیاس، برای Android)
 *   - apple-touch-icon.png (180×180، بدون شفافیت)
 *
 * طرح: پس‌زمینهٔ گرادیان آسمی (هم‌رنگ برند) + نوار سفید «برش» مورب
 *       + خط شیار موازی + تکهٔ ورق بریده‌شده در گوشهٔ بالا-چپ.
 */
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

/* ---------------- CRC32 ---------------- */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ---------------- نویسندهٔ PNG (RGBA 8-bit) ---------------- */
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  const stride = 1 + size * 4;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: None
    raw.set(rgba.subarray(y * size * 4, (y + 1) * size * 4), y * stride + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------------- نقاشی ---------------- */
const SKY_TOP = [125, 211, 252]; // sky-300
const SKY_BOTTOM = [3, 105, 161]; // sky-700

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/** آیا نقطه داخل مستطیل گردی است؟ (مرکز cx,cy — نصف‌قطر هر ضلع half — شعاع گوشه r) */
function inRoundedRect(u, v, cx, cy, half, r) {
  if (u < cx - half || u > cx + half || v < cy - half || v > cy + half) return false;
  const px = Math.max(cx - half + r, Math.min(u, cx + half - r));
  const py = Math.max(cy - half + r, Math.min(v, cy + half - r));
  const dx = u - px;
  const dy = v - py;
  return dx * dx + dy * dy <= r * r;
}

function paint(size, maskable) {
  const img = new Uint8ClampedArray(size * size * 4);
  const margin = maskable ? 0.1 : 0; // منطقهٔ امن maskable: طرح در ۸۰ٔ مرکز
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ub = x / size; // مختصات پس‌زمینه (تمام بوم)
      const vb = y / size;
      const inside = maskable || inRoundedRect(ub, vb, 0.5, 0.5, 0.5, 0.22);
      if (!inside) continue; // شفاف (گوشه‌های آیکون معمولی)

      const du = maskable ? (ub - margin) / (1 - 2 * margin) : ub;
      const dv = maskable ? (vb - margin) / (1 - 2 * margin) : vb;

      let [r, g, b] = mix(SKY_TOP, SKY_BOTTOM, vb);
      let alpha = 255;

      if (du >= 0 && du <= 1 && dv >= 0 && dv <= 1) {
        // فاصلهٔ عمودی از قطرِ برش (u+v=1)
        const d = (du + dv - 1) / Math.SQRT2;
        // خط شیار موازی (نازک، نیمه‌شفاف)
        if (Math.abs(d - 0.17) < 0.008) {
          r = 255; g = 255; b = 255; alpha = 110;
        } else if (Math.abs(d) <= 0.058) {
          r = 255; g = 255; b = 255; // تنهٔ نوار برش
        } else if (Math.abs(d) <= 0.085) {
          r = 224; g = 242; b = 254; // لبهٔ روشن نوار
        }
        // تکهٔ ورق بریده‌شده در گوشهٔ بالا-چپ
        if (inRoundedRect(du, dv, 0.16, 0.17, 0.065, 0.02)) {
          r = 255; g = 255; b = 255; alpha = 255;
        }
      }

      const o = (y * size + x) * 4;
      img[o] = r; img[o + 1] = g; img[o + 2] = b; img[o + 3] = alpha;
    }
  }
  return img;
}

/* ---------------- اجرا ---------------- */
mkdirSync(OUT_DIR, { recursive: true });
const jobs = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-192.png', 192, true],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, true],
];
for (const [name, size, maskable] of jobs) {
  const png = encodePng(size, paint(size, maskable));
  writeFileSync(join(OUT_DIR, name), png);
  console.log(`✔ ${name} (${size}×${size}${maskable ? ', maskable' : ''})`);
}
console.log(`آیکون‌ها در ${OUT_DIR} ساخته شدند.`);
