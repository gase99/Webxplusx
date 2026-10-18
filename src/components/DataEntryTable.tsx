import {
  useEffect,
  useRef,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
} from 'react';
import {
  createPart,
  createPartId,
  createSampleParts,
  isEmptyPart,
  type CutPart,
  type EditableField,
  type FlagField,
} from '../types/part';
import { BandIcon, CopyIcon, FarsiIcon, GrooveIcon, PlusIcon, TrashIcon } from './icons';

interface DataEntryTableProps {
  rows: CutPart[];
  setRows: Dispatch<SetStateAction<CutPart[]>>;
  activeId: string | null;
  onActiveChange: (id: string) => void;
}

/** ترتیب حرکت فوکوس با Enter: نام قطعه ← طول ← عرض ← تعداد ← ردیف جدید */
const NEXT_FIELD: Record<EditableField, EditableField | 'NEW_ROW'> = {
  name: 'length',
  length: 'width',
  width: 'qty',
  qty: 'NEW_ROW',
};

const faNumber = new Intl.NumberFormat('fa-IR');

/** تبدیل ارقام فارسی/عربی تایپ‌شده به ارقام لاتین برای عددهای ابعاد */
function normalizeDigits(raw: string): string {
  return raw
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function parseDimension(raw: string): number {
  const cleaned = normalizeDigits(raw).replace(/[^0-9.]/g, '');
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : 0;
}

function parseQty(raw: string): number {
  const cleaned = normalizeDigits(raw).replace(/[^0-9]/g, '');
  const value = parseInt(cleaned, 10);
  return Number.isFinite(value) ? value : 0;
}

/* ---------------- کلاس‌های ظاهری گروه‌های ستونی ---------------- */

/** هر گروه (نوار/فارسی/شیار) رنگ متمایز مخصوص خودش را دارد */
const GROUP = {
  band: {
    header: 'bg-teal-200/80 text-teal-950 border-teal-300',
    subHeader: 'bg-teal-100 text-teal-900 border-teal-200',
    cell: 'bg-teal-50 border-teal-200/80',
    cellChecked: 'bg-teal-200/70',
    checkbox: 'accent-teal-700',
  },
  farsi: {
    header: 'bg-rose-200/90 text-rose-950 border-rose-300',
    subHeader: 'bg-rose-100 text-rose-900 border-rose-200',
    cell: 'bg-rose-50 border-rose-200/80',
    cellChecked: 'bg-rose-200/80',
    checkbox: 'accent-rose-700',
  },
  groove: {
    header: 'bg-amber-200/80 text-amber-950 border-amber-300',
    subHeader: 'bg-amber-100 text-amber-900 border-amber-200',
    cell: 'bg-amber-50 border-amber-200/80',
    cellChecked: 'bg-amber-200/70',
    checkbox: 'accent-amber-700',
  },
} as const;

type GroupKey = keyof typeof GROUP;

export default function DataEntryTable({
  rows,
  setRows,
  activeId,
  onActiveChange,
}: DataEntryTableProps) {
  /**
   * نگاشت رف‌های اینپوت‌ها: کلید = `${rowId}:${field}`
   * برای مدیریت فوکوس در ناوبری کیبورد (Enter / جهت‌نماها) استفاده می‌شود.
   */
  const inputRefs = useRef(new Map<string, HTMLInputElement>());
  /** فوکوس معلّق: بعد از رندر ردیف جدید اعمال می‌شود */
  const pendingFocusRef = useRef<{ id: string; field: EditableField } | null>(null);

  const registerRef =
    (rowId: string, field: EditableField) =>
    (el: HTMLInputElement | null): void => {
      const key = `${rowId}:${field}`;
      if (el) inputRefs.current.set(key, el);
      else inputRefs.current.delete(key);
    };

  const focusField = (rowId: string, field: EditableField) => {
    const el = inputRefs.current.get(`${rowId}:${field}`);
    if (el) {
      el.focus();
      el.select();
    }
  };

  /** اعمال فوکوس معلّق پس از اضافه‌شدن/حذف ردیف و رندر مجدد */
  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (pending) {
      pendingFocusRef.current = null;
      focusField(pending.id, pending.field);
    }
  }, [rows]);

  /** فوکوس اولیه روی «نام قطعه» ردیف اول هنگام بارگذاری صفحه */
  useEffect(() => {
    const firstEmpty = rows.find(isEmptyPart) ?? rows[0];
    if (firstEmpty) focusField(firstEmpty.id, 'name');
    // فقط در مونت اولیه
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- عملیات روی ردیف‌ها ---------------- */

  const updateRow = (id: string, patch: Partial<CutPart>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  /** درج ردیف جدید بلافاصله بعد از ردیف جاری و انتقال فوکوس به نام قطعهٔ آن */
  const insertRowAfter = (afterId: string | null, source?: CutPart) => {
    // در حالت تکثیر، مقادیر از ردیف مبدأ کپی می‌شود ولی شناسه تازه است
    const fresh: CutPart = source ? { ...source, id: createPartId() } : createPart();

    pendingFocusRef.current = { id: fresh.id, field: 'name' };
    onActiveChange(fresh.id);
    setRows((prev) => {
      if (!afterId) return [...prev, fresh];
      const idx = prev.findIndex((r) => r.id === afterId);
      if (idx === -1) return [...prev, fresh];
      const next = [...prev];
      next.splice(idx + 1, 0, fresh);
      return next;
    });
  };

  const deleteRow = (id: string) => {
    if (rows.length <= 1) return;
    const idx = rows.findIndex((r) => r.id === id);
    const neighbor = rows[idx + 1] ?? rows[idx - 1];
    if (neighbor) {
      pendingFocusRef.current = { id: neighbor.id, field: 'name' };
      onActiveChange(neighbor.id);
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const loadSample = () => {
    const hasData = rows.some((r) => !isEmptyPart(r));
    if (hasData && !window.confirm('داده‌های فعلی با دادهٔ نمونه جایگزین شود؟')) return;
    const sample = createSampleParts();
    const firstEmpty = sample.find(isEmptyPart) ?? sample[0];
    pendingFocusRef.current = { id: firstEmpty.id, field: 'name' };
    onActiveChange(firstEmpty.id);
    setRows(sample);
  };

  const removeEmptyRows = () => {
    setRows((prev) => {
      const kept = prev.filter((r) => !isEmptyPart(r));
      return kept.length > 0 ? kept : [createPart()];
    });
  };

  const clearAll = () => {
    if (!window.confirm('همهٔ ردیف‌ها حذف شوند؟')) return;
    const fresh = createPart();
    pendingFocusRef.current = { id: fresh.id, field: 'name' };
    onActiveChange(fresh.id);
    setRows([fresh]);
  };

  /* ---------------- ناوبری کیبورد ---------------- */

  /**
   * رفتار اصلی (طبق مشخصات):
   *  Enter در نام قطعه ← طول
   *  Enter در طول      ← عرض
   *  Enter در عرض      ← تعداد
   *  Enter در تعداد    ← درج ردیف جدید و فوکوس روی نام قطعهٔ ردیف جدید
   * امکانات تکمیلی: جهت‌نمای بالا/پایین بین ردیف‌ها در همان ستون حرکت می‌کند.
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, row: CutPart, field: EditableField) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const next = NEXT_FIELD[field];
      if (next === 'NEW_ROW') {
        insertRowAfter(row.id);
      } else {
        focusField(row.id, next);
      }
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = rows.findIndex((r) => r.id === row.id);
      const target = e.key === 'ArrowDown' ? rows[idx + 1] : rows[idx - 1];
      if (target) {
        onActiveChange(target.id);
        focusField(target.id, field);
      }
    }
  };

  /* ---------------- سلول‌های کمکی ---------------- */

  const renderFlagCell = (row: CutPart, flag: FlagField, groupKey: GroupKey, label: string) => {
    const group = GROUP[groupKey];
    const checked = row[flag];
    const isFarsi = groupKey === 'farsi';
    return (
      <td
        key={flag}
        className={`border p-0 align-middle ${group.cell} ${checked ? group.cellChecked : ''}`}
      >
        <label
          className="flex h-full w-full cursor-pointer items-center justify-center gap-1 px-1 py-2.5"
          title={label}
        >
          <input
            type="checkbox"
            checked={checked}
            aria-label={label}
            onChange={(e) => updateRow(row.id, { [flag]: e.target.checked })}
            onFocus={() => onActiveChange(row.id)}
            className={`h-[18px] w-[18px] shrink-0 ${group.checkbox}`}
          />
          {/* در ستون فارسی، آیکون مثلث/خط مورب کنار چک‌باکس می‌آید تا شکل
              نمایش آن در نقشهٔ برش (خط قرمز + هاشور + ۴۵°) برای کاربر روشن باشد */}
          {isFarsi && (
            <span className="inline-flex items-center gap-0.5" aria-hidden="true">
              <FarsiIcon active={checked} />
              <span
                className={`text-[10px] font-bold leading-none ${
                  checked ? 'text-rose-700' : 'text-rose-400/70'
                }`}
              >
                ۴۵°
              </span>
            </span>
          )}
        </label>
      </td>
    );
  };

  const inputBase =
    'w-full bg-transparent px-2 py-2.5 outline-none transition focus:bg-white focus:shadow-[inset_0_0_0_2px_#0284c7]';

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-300/70">
      {/* نوار ابزار جدول */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <button
          type="button"
          onClick={() => insertRowAfter(activeId ?? rows[rows.length - 1]?.id ?? null)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-sky-600 active:scale-[0.98]"
        >
          <PlusIcon />
          افزودن ردیف
        </button>
        <button
          type="button"
          onClick={loadSample}
          className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-100"
        >
          دادهٔ نمونه
        </button>
        <button
          type="button"
          onClick={removeEmptyRows}
          className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-100"
        >
          حذف ردیف‌های خالی
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-50"
        >
          پاک‌کردن همه
        </button>
        <span className="ms-auto hidden text-xs text-slate-500 lg:block">
          برای ثبت سریع: در ستون «تعداد» کلید
          <kbd className="mx-1 rounded border border-slate-300 bg-white px-1.5 py-0.5 font-sans text-[11px] font-bold text-slate-700 shadow-[0_1px_0_#cbd5e1]">
            Enter ↵
          </kbd>
          را بزنید تا ردیف جدید ساخته شود.
        </span>
      </div>

      {/* جدول ورود اطلاعات */}
      <div className="table-scroll max-h-[62vh] overflow-auto">
        <table className="w-full min-w-[1020px] border-collapse text-sm">
          <thead>
            {/* سطح اول هدر */}
            <tr className="text-center">
              <th
                rowSpan={2}
                className="sticky top-0 z-20 h-11 w-12 border border-slate-300 bg-slate-700 px-1 text-white"
              >
                ردیف
              </th>
              <th
                rowSpan={2}
                className="sticky top-0 z-20 border border-slate-300 bg-slate-700 px-2 text-white"
              >
                نام قطعه
              </th>
              <th
                rowSpan={2}
                className="sticky top-0 z-20 w-28 border border-slate-300 bg-slate-700 px-2 text-white"
              >
                طول <span className="block text-[10px] font-normal text-slate-300">(میلی‌متر)</span>
              </th>
              <th
                rowSpan={2}
                className="sticky top-0 z-20 w-28 border border-slate-300 bg-slate-700 px-2 text-white"
              >
                عرض <span className="block text-[10px] font-normal text-slate-300">(میلی‌متر)</span>
              </th>
              <th
                rowSpan={2}
                className="sticky top-0 z-20 w-20 border border-slate-300 bg-slate-700 px-2 text-white"
              >
                تعداد
              </th>
              <th colSpan={2} className={`sticky top-0 z-20 border px-2 py-1.5 ${GROUP.band.header}`}>
                <span className="inline-flex items-center gap-1.5 font-extrabold">
                  <BandIcon />
                  نوار
                  <span className="text-[10px] font-medium opacity-70">(لبه‌چسب)</span>
                </span>
              </th>
              <th colSpan={2} className={`sticky top-0 z-20 border px-2 py-1.5 ${GROUP.farsi.header}`}>
                <span className="inline-flex items-center gap-1.5 font-extrabold">
                  <FarsiIcon active />
                  فارسی
                  <span className="text-[10px] font-medium opacity-70">(برش ۴۵°)</span>
                </span>
              </th>
              <th colSpan={2} className={`sticky top-0 z-20 border px-2 py-1.5 ${GROUP.groove.header}`}>
                <span className="inline-flex items-center gap-1.5 font-extrabold">
                  <GrooveIcon />
                  شیار
                  <span className="text-[10px] font-medium opacity-70">(ورق ۳ میل)</span>
                </span>
              </th>
              <th
                rowSpan={2}
                className="sticky top-0 z-20 w-24 border border-slate-300 bg-slate-700 px-1 text-white"
              >
                عملیات
              </th>
            </tr>
            {/* سطح دوم هدر: زیرستون‌های طول / عرض */}
            <tr className="text-center text-xs">
              <th className={`sticky top-11 z-20 w-[76px] border px-1 py-1.5 ${GROUP.band.subHeader}`}>طول</th>
              <th className={`sticky top-11 z-20 w-[76px] border px-1 py-1.5 ${GROUP.band.subHeader}`}>عرض</th>
              <th className={`sticky top-11 z-20 w-[92px] border px-1 py-1.5 ${GROUP.farsi.subHeader}`}>طول</th>
              <th className={`sticky top-11 z-20 w-[92px] border px-1 py-1.5 ${GROUP.farsi.subHeader}`}>عرض</th>
              <th className={`sticky top-11 z-20 w-[76px] border px-1 py-1.5 ${GROUP.groove.subHeader}`}>طول</th>
              <th className={`sticky top-11 z-20 w-[76px] border px-1 py-1.5 ${GROUP.groove.subHeader}`}>عرض</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => {
              const isActive = row.id === activeId;
              const started = row.name.trim() !== '' || row.length > 0 || row.width > 0;
              const invalid = (field: EditableField) =>
                started &&
                ((field === 'name' && row.name.trim() === '') ||
                  (field === 'length' && row.length <= 0) ||
                  (field === 'width' && row.width <= 0) ||
                  (field === 'qty' && row.qty <= 0));

              return (
                <tr
                  key={row.id}
                  onMouseDown={() => onActiveChange(row.id)}
                  className={`transition-colors ${
                    isActive ? 'bg-sky-50' : index % 2 === 1 ? 'bg-slate-50/60 hover:bg-slate-100/70' : 'hover:bg-slate-100/70'
                  }`}
                >
                  {/* شماره ردیف */}
                  <td
                    className={`border border-slate-200 px-1 py-2 text-center align-middle font-bold ${
                      isActive ? 'text-sky-800' : 'text-slate-500'
                    }`}
                  >
                    <span
                      className={`inline-flex min-h-6 min-w-6 items-center justify-center rounded-md px-1 text-xs ${
                        isActive ? 'bg-sky-700 text-white' : 'bg-slate-200/80 text-slate-600'
                      }`}
                    >
                      {faNumber.format(index + 1)}
                    </span>
                  </td>

                  {/* نام قطعه */}
                  <td className="border border-slate-200 p-0 align-middle">
                    <input
                      ref={registerRef(row.id, 'name')}
                      type="text"
                      value={row.name}
                      placeholder="نام قطعه…"
                      aria-label={`نام قطعه ردیف ${index + 1}`}
                      onChange={(e) => updateRow(row.id, { name: e.target.value })}
                      onKeyDown={(e) => handleKeyDown(e, row, 'name')}
                      onFocus={(e) => {
                        onActiveChange(row.id);
                        e.target.select();
                      }}
                      className={`${inputBase} font-medium placeholder:font-normal placeholder:text-slate-300 ${
                        invalid('name') ? 'bg-rose-50 placeholder:text-rose-300' : ''
                      }`}
                    />
                  </td>

                  {/* طول */}
                  <td className="border border-slate-200 p-0 align-middle">
                    <input
                      ref={registerRef(row.id, 'length')}
                      type="text"
                      inputMode="decimal"
                      dir="ltr"
                      value={row.length ? String(row.length) : ''}
                      placeholder="0"
                      aria-label={`طول ردیف ${index + 1}`}
                      onChange={(e) => updateRow(row.id, { length: parseDimension(e.target.value) })}
                      onKeyDown={(e) => handleKeyDown(e, row, 'length')}
                      onFocus={(e) => {
                        onActiveChange(row.id);
                        e.target.select();
                      }}
                      className={`${inputBase} text-center font-semibold tabular-nums placeholder:text-slate-300 ${
                        invalid('length') ? 'bg-rose-50' : ''
                      }`}
                    />
                  </td>

                  {/* عرض */}
                  <td className="border border-slate-200 p-0 align-middle">
                    <input
                      ref={registerRef(row.id, 'width')}
                      type="text"
                      inputMode="decimal"
                      dir="ltr"
                      value={row.width ? String(row.width) : ''}
                      placeholder="0"
                      aria-label={`عرض ردیف ${index + 1}`}
                      onChange={(e) => updateRow(row.id, { width: parseDimension(e.target.value) })}
                      onKeyDown={(e) => handleKeyDown(e, row, 'width')}
                      onFocus={(e) => {
                        onActiveChange(row.id);
                        e.target.select();
                      }}
                      className={`${inputBase} text-center font-semibold tabular-nums placeholder:text-slate-300 ${
                        invalid('width') ? 'bg-rose-50' : ''
                      }`}
                    />
                  </td>

                  {/* تعداد */}
                  <td className="border border-slate-200 p-0 align-middle">
                    <input
                      ref={registerRef(row.id, 'qty')}
                      type="text"
                      inputMode="numeric"
                      dir="ltr"
                      value={row.qty ? String(row.qty) : ''}
                      placeholder="1"
                      aria-label={`تعداد ردیف ${index + 1}`}
                      onChange={(e) => updateRow(row.id, { qty: parseQty(e.target.value) })}
                      onKeyDown={(e) => handleKeyDown(e, row, 'qty')}
                      onFocus={(e) => {
                        onActiveChange(row.id);
                        e.target.select();
                      }}
                      className={`${inputBase} text-center font-semibold tabular-nums placeholder:text-slate-300 ${
                        invalid('qty') ? 'bg-rose-50' : ''
                      }`}
                    />
                  </td>

                  {/* نوار: طول / عرض */}
                  {renderFlagCell(row, 'bandLength', 'band', `نوار در طول — ردیف ${index + 1}`)}
                  {renderFlagCell(row, 'bandWidth', 'band', `نوار در عرض — ردیف ${index + 1}`)}

                  {/* فارسی (برش ۴۵°): طول / عرض */}
                  {renderFlagCell(row, 'farsiLength', 'farsi', `برش فارسی ۴۵ درجه در طول — ردیف ${index + 1}`)}
                  {renderFlagCell(row, 'farsiWidth', 'farsi', `برش فارسی ۴۵ درجه در عرض — ردیف ${index + 1}`)}

                  {/* شیار: طول / عرض */}
                  {renderFlagCell(row, 'grooveLength', 'groove', `شیار در طول — ردیف ${index + 1}`)}
                  {renderFlagCell(row, 'grooveWidth', 'groove', `شیار در عرض — ردیف ${index + 1}`)}

                  {/* عملیات: تکثیر / حذف */}
                  <td className="border border-slate-200 px-1 py-1.5 text-center align-middle">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        title="تکثیر ردیف"
                        aria-label={`تکثیر ردیف ${index + 1}`}
                        onClick={() => insertRowAfter(row.id, row)}
                        className="rounded-md p-1.5 text-slate-500 transition hover:bg-sky-100 hover:text-sky-700"
                      >
                        <CopyIcon />
                      </button>
                      <button
                        type="button"
                        title="حذف ردیف"
                        aria-label={`حذف ردیف ${index + 1}`}
                        disabled={rows.length <= 1}
                        onClick={() => deleteRow(row.id)}
                        className="rounded-md p-1.5 text-slate-500 transition hover:bg-rose-100 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* پابرگ جدول: ردیف افزودن سریع */}
      <button
        type="button"
        onClick={() => insertRowAfter(rows[rows.length - 1]?.id ?? null)}
        className="flex w-full items-center justify-center gap-1.5 border-t border-dashed border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-sky-800 transition hover:bg-sky-50"
      >
        <PlusIcon className="h-3.5 w-3.5" />
        افزودن ردیف جدید
        <span className="text-xs font-normal text-slate-400">(یا Enter در ستون تعداد)</span>
      </button>

    </section>
  );
}
