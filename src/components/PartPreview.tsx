import type { ReactNode } from 'react';
import type { CutPart } from '../types/part';

const faNumber = new Intl.NumberFormat('fa-IR');

const COLOR = {
  edge: '#64748b', // slate-500
  fill: '#f8fafc',
  band: '#0d9488', // teal-600 — نوار
  farsi: '#e11d48', // rose-600 — فارسی
  groove: '#d97706', // amber-600 — شیار
  text: '#334155',
};

/**
 * پیش‌نمایش لبه‌های قطعهٔ فعال — و هم‌زمان «پیاده‌سازی مرجع» قرارداد رندر فاز ۳:
 *
 *  🔴 فاز ۳ (نقشهٔ برش): اگر `farsiLength` یا `farsiWidth` برابر true باشد، آن لبه
 *      باید دقیقاً همین‌طور رندر شود: خط قرمز + هاشور مورب + برچسب «۴۵°».
 *  🟢 نوار: خط ضخیم سبزآبی روی لبه.
 *  🟠 شیار: خط‌چین کهربایی موازی و کمی داخل‌تر از لبه (محل ورق ۳ میل).
 *
 * قرارداد رسم: طول (Length) افقی و عرض (Width) عمودی است؛
 *  `*Length` ← لبه‌های بالا و پایین | `*Width` ← لبه‌های چپ و راست
 */
export default function PartPreview({ part }: { part: CutPart | null }) {
  const W = 360;
  const H = 240;
  const margin = 44;

  if (!part) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-slate-400">
        ردیفی انتخاب نشده است.
      </div>
    );
  }

  const length = part.length > 0 ? part.length : 600;
  const width = part.width > 0 ? part.width : 400;

  const availW = W - margin * 2;
  const availH = H - margin * 2;
  const scale = Math.min(availW / length, availH / width);
  const rw = Math.max(60, length * scale);
  const rh = Math.max(44, width * scale);
  const x = (W - rw) / 2;
  const y = (H - rh) / 2 - 4;

  /** هاشور مورب قرمز روی یک لبهٔ فارسی */
  const hatch = (side: 'top' | 'bottom' | 'left' | 'right') => {
    const lines: ReactNode[] = [];
    const step = 11;
    const len = 7;
    if (side === 'top' || side === 'bottom') {
      const yy = side === 'top' ? y : y + rh;
      const dir = side === 'top' ? -1 : 1;
      for (let tx = x + 6; tx < x + rw - 2; tx += step) {
        lines.push(
          <line
            key={`${side}-${tx}`}
            x1={tx}
            y1={yy}
            x2={tx - len * 0.7}
            y2={yy + dir * len}
            stroke={COLOR.farsi}
            strokeWidth="1.4"
            strokeLinecap="round"
          />,
        );
      }
    } else {
      const xx = side === 'left' ? x : x + rw;
      const dir = side === 'left' ? -1 : 1;
      for (let ty = y + 6; ty < y + rh - 2; ty += step) {
        lines.push(
          <line
            key={`${side}-${ty}`}
            x1={xx}
            y1={ty}
            x2={xx + dir * len}
            y2={ty - len * 0.7}
            stroke={COLOR.farsi}
            strokeWidth="1.4"
            strokeLinecap="round"
          />,
        );
      }
    }
    return lines;
  };

  const grooveInset = 8;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-[420px]" role="img" aria-label="پیش‌نمایش لبه‌های قطعه">
      {/* بدنهٔ قطعه */}
      <rect x={x} y={y} width={rw} height={rh} rx="2" fill={COLOR.fill} stroke={COLOR.edge} strokeWidth="1.4" />

      {/* شیار: خط‌چین موازی لبه، داخل قطعه */}
      {part.grooveLength && (
        <>
          <line x1={x + 3} y1={y + grooveInset} x2={x + rw - 3} y2={y + grooveInset} stroke={COLOR.groove} strokeWidth="2" strokeDasharray="7 4" />
          <line x1={x + 3} y1={y + rh - grooveInset} x2={x + rw - 3} y2={y + rh - grooveInset} stroke={COLOR.groove} strokeWidth="2" strokeDasharray="7 4" />
        </>
      )}
      {part.grooveWidth && (
        <>
          <line x1={x + grooveInset} y1={y + 3} x2={x + grooveInset} y2={y + rh - 3} stroke={COLOR.groove} strokeWidth="2" strokeDasharray="7 4" />
          <line x1={x + rw - grooveInset} y1={y + 3} x2={x + rw - grooveInset} y2={y + rh - 3} stroke={COLOR.groove} strokeWidth="2" strokeDasharray="7 4" />
        </>
      )}

      {/* نوار: خط ضخیم روی لبه */}
      {part.bandLength && (
        <>
          <line x1={x} y1={y} x2={x + rw} y2={y} stroke={COLOR.band} strokeWidth="5" strokeLinecap="square" />
          <line x1={x} y1={y + rh} x2={x + rw} y2={y + rh} stroke={COLOR.band} strokeWidth="5" strokeLinecap="square" />
        </>
      )}
      {part.bandWidth && (
        <>
          <line x1={x} y1={y} x2={x} y2={y + rh} stroke={COLOR.band} strokeWidth="5" strokeLinecap="square" />
          <line x1={x + rw} y1={y} x2={x + rw} y2={y + rh} stroke={COLOR.band} strokeWidth="5" strokeLinecap="square" />
        </>
      )}

      {/* فارسی: خط قرمز + هاشور + برچسب ۴۵° (قرارداد رندر فاز ۳) */}
      {part.farsiLength && (
        <>
          <line x1={x} y1={y} x2={x + rw} y2={y} stroke={COLOR.farsi} strokeWidth="2.4" />
          <line x1={x} y1={y + rh} x2={x + rw} y2={y + rh} stroke={COLOR.farsi} strokeWidth="2.4" />
          {hatch('top')}
          {hatch('bottom')}
          <text x={x + rw / 2} y={y - 12} textAnchor="middle" fontSize="12" fontWeight="800" fill={COLOR.farsi}>
            ۴۵°
          </text>
          <text x={x + rw / 2} y={y + rh + 24} textAnchor="middle" fontSize="12" fontWeight="800" fill={COLOR.farsi}>
            ۴۵°
          </text>
        </>
      )}
      {part.farsiWidth && (
        <>
          <line x1={x} y1={y} x2={x} y2={y + rh} stroke={COLOR.farsi} strokeWidth="2.4" />
          <line x1={x + rw} y1={y} x2={x + rw} y2={y + rh} stroke={COLOR.farsi} strokeWidth="2.4" />
          {hatch('left')}
          {hatch('right')}
          <text x={x - 14} y={y + rh / 2} textAnchor="middle" dominantBaseline="middle" fontSize="12" fontWeight="800" fill={COLOR.farsi} transform={`rotate(-90 ${x - 14} ${y + rh / 2})`}>
            ۴۵°
          </text>
          <text x={x + rw + 14} y={y + rh / 2} textAnchor="middle" dominantBaseline="middle" fontSize="12" fontWeight="800" fill={COLOR.farsi} transform={`rotate(-90 ${x + rw + 14} ${y + rh / 2})`}>
            ۴۵°
          </text>
        </>
      )}

      {/* برچسب ابعاد */}
      {!part.farsiLength && (
        <text x={x + rw / 2} y={y + rh + 22} textAnchor="middle" fontSize="12" fill={COLOR.text} style={{ direction: 'ltr' }}>
          {part.length > 0 ? `${part.length} mm` : 'طول؟'}
        </text>
      )}
      {!part.farsiWidth && (
        <text
          x={x - 12}
          y={y + rh / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="12"
          fill={COLOR.text}
          transform={`rotate(-90 ${x - 12} ${y + rh / 2})`}
          style={{ direction: 'ltr' }}
        >
          {part.width > 0 ? `${part.width} mm` : 'عرض؟'}
        </text>
      )}

      {/* نام و تعداد در مرکز قطعه */}
      <text x={W / 2} y={H / 2 - 6} textAnchor="middle" fontSize="14" fontWeight="700" fill={COLOR.text}>
        {part.name.trim() || 'قطعهٔ بدون نام'}
      </text>
      <text x={W / 2} y={H / 2 + 16} textAnchor="middle" fontSize="12" fill="#64748b">
        {faNumber.format(length)} × {faNumber.format(width)} — تعداد: {faNumber.format(part.qty || 0)}
      </text>
    </svg>
  );
}
