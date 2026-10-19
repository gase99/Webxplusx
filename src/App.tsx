import { useEffect, useMemo, useState, type ReactNode } from 'react';
import DataEntryTable from './components/DataEntryTable';
import LayoutPanel from './components/LayoutPanel';
import ProjectManager from './components/ProjectManager';
import PartPreview from './components/PartPreview';
import {
  BandIcon,
  FarsiIcon,
  GrooveIcon,
  InstagramIcon,
  LogoIcon,
  TelegramIcon,
} from './components/icons';
import { createPart, isEmptyPart, isValidPart, type CutPart } from './types/part';
import {
  DEFAULT_LAYOUT_SETTINGS,
  UNTITLED_PROJECT_NAME,
  cloneParts,
  computeLayoutSignature,
  computeWorkspaceSignature,
  createProjectId,
  settingsFromLayout,
  type LayoutSettings,
  type LayoutState,
  type Project,
} from './types/project';
import {
  loadProjects,
  loadWorkspaceDraft,
  saveProjects,
  saveWorkspaceDraft,
} from './storage/projects';

const faNumber = new Intl.NumberFormat('fa-IR');
const faDecimal = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });

export default function App() {
  // فضای کاری اولیه از پیش‌نویس خودکار بازیابی می‌شود (رفرش صفحه کار را از بین نمی‌برد)
  const [initialWorkspace] = useState(loadWorkspaceDraft);
  const [rows, setRows] = useState<CutPart[]>(initialWorkspace.parts);
  const [activeId, setActiveId] = useState<string | null>(
    () => (initialWorkspace.parts.find(isEmptyPart) ?? initialWorkspace.parts[0])?.id ?? null,
  );
  const [settings, setSettings] = useState<LayoutSettings>(initialWorkspace.settings);
  const [layoutState, setLayoutState] = useState<LayoutState | null>(initialWorkspace.layoutState);

  // --- فاز ۵: مدیریت پروژه‌ها ---
  const [projects, setProjects] = useState<Project[]>(loadProjects);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(initialWorkspace.projectId);
  const [currentProjectName, setCurrentProjectName] = useState(initialWorkspace.projectName);
  const [baselineSignature, setBaselineSignature] = useState(initialWorkspace.baselineSignature);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const workspaceSignature = useMemo(
    () => computeWorkspaceSignature(rows, settings, currentProjectName),
    [rows, settings, currentProjectName],
  );
  const isDirty = workspaceSignature !== baselineSignature;

  // ذخیرهٔ فهرست پروژه‌ها و پیش‌نویس خودکار فضای کاری
  useEffect(() => {
    saveProjects(projects);
  }, [projects]);
  useEffect(() => {
    saveWorkspaceDraft({
      projectId: currentProjectId,
      projectName: currentProjectName,
      parts: rows,
      settings,
      layoutState,
      baselineSignature,
    });
  }, [rows, settings, layoutState, currentProjectId, currentProjectName, baselineSignature]);

  // هشدار هنگام بستن/رفرش صفحه اگر تغییرات ذخیره‌نشده داریم
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'تغییرات ذخیره‌نشده دارید. مطمئنید می‌خواهید خارج شوید؟';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  useEffect(() => {
    if (!saveNotice) return;
    const t = window.setTimeout(() => setSaveNotice(null), 3500);
    return () => window.clearTimeout(t);
  }, [saveNotice]);

  /** بارگذاری کامل یک پروژه در فضای کاری (قطعات، تنظیمات و نقشهٔ ذخیره‌شده) */
  const applyProject = (project: Project) => {
    const parts = project.parts.length > 0 ? cloneParts(project.parts) : [createPart()];
    setRows(parts);
    setSettings({ ...project.settings });
    setLayoutState(
      project.lastLayout
        ? {
            result: project.lastLayout,
            partsSnapshot: cloneParts(project.lastLayoutParts ?? project.parts),
            signature: computeLayoutSignature(
              project.lastLayoutParts ?? project.parts,
              settingsFromLayout(project.lastLayout),
            ),
          }
        : null,
    );
    setCurrentProjectId(project.id);
    setCurrentProjectName(project.name);
    setActiveId((parts.find(isEmptyPart) ?? parts[0])?.id ?? null);
    setBaselineSignature(computeWorkspaceSignature(parts, project.settings, project.name));
  };

  const confirmDiscardIfDirty = (action: string): boolean =>
    !isDirty ||
    window.confirm(
      `پروژهٔ فعلی («${currentProjectName}») تغییرات ذخیره‌نشده دارد. با ${action} این تغییرات از دست می‌رود. ادامه می‌دهید؟`,
    );

  const handleSaveProject = (saveAs = false) => {
    const now = Date.now();
    let id = currentProjectId;
    let name = currentProjectName;
    let createdAt = projects.find((p) => p.id === id)?.createdAt ?? now;

    if (!id || saveAs) {
      const suggested = saveAs
        ? `${name} - کپی`
        : name === UNTITLED_PROJECT_NAME
          ? 'پروژهٔ جدید'
          : name;
      const input = window.prompt(saveAs ? 'نام نسخهٔ جدید پروژه:' : 'نام پروژه را وارد کنید:', suggested);
      if (input === null) return;
      name = input.trim() || suggested;
      id = createProjectId();
      createdAt = now;
    }

    const project: Project = {
      id,
      name,
      createdAt,
      updatedAt: now,
      parts: cloneParts(rows),
      settings: { ...settings },
      lastLayout: layoutState?.result,
      lastLayoutParts: layoutState ? cloneParts(layoutState.partsSnapshot) : undefined,
    };
    const next = projects.some((p) => p.id === id)
      ? projects.map((p) => (p.id === id ? project : p))
      : [project, ...projects];
    if (!saveProjects(next)) {
      window.alert('ذخیره انجام نشد: فضای ذخیره‌سازی مرورگر پر است. چند پروژهٔ قدیمی را حذف کنید.');
      return;
    }
    setProjects(next);
    setCurrentProjectId(id);
    setCurrentProjectName(name);
    setBaselineSignature(computeWorkspaceSignature(rows, settings, name));
    setSaveNotice(`پروژهٔ «${name}» ذخیره شد ✓`);
  };

  const handleOpenProject = (project: Project) => {
    if (!confirmDiscardIfDirty('باز کردن پروژهٔ دیگر')) return;
    applyProject(project);
    setSaveNotice(`پروژهٔ «${project.name}» باز شد`);
  };

  const handleDeleteProject = (project: Project) => {
    if (!window.confirm(`پروژهٔ «${project.name}» حذف شود؟ این عمل قابل بازگشت نیست.`)) return;
    const next = projects.filter((p) => p.id !== project.id);
    saveProjects(next);
    setProjects(next);
    if (project.id === currentProjectId) {
      // محتوای فعلی می‌ماند ولی دیگر نسخهٔ ذخیره‌شده ندارد ⇒ ذخیره‌نشده محسوب می‌شود
      setCurrentProjectId(null);
      setBaselineSignature('__unsaved__');
    }
    setSaveNotice(`پروژهٔ «${project.name}» حذف شد`);
  };

  const handleNewProject = () => {
    if (!confirmDiscardIfDirty('شروع پروژهٔ جدید')) return;
    const empty = [createPart()];
    const freshSettings = { ...DEFAULT_LAYOUT_SETTINGS };
    setRows(empty);
    setSettings(freshSettings);
    setLayoutState(null);
    setCurrentProjectId(null);
    setCurrentProjectName(UNTITLED_PROJECT_NAME);
    setActiveId(empty[0].id);
    setBaselineSignature(computeWorkspaceSignature(empty, freshSettings, UNTITLED_PROJECT_NAME));
    setSaveNotice('پروژهٔ جدید شروع شد');
  };

  const activePart = useMemo(
    () => rows.find((r) => r.id === activeId) ?? rows[0] ?? null,
    [rows, activeId],
  );

  /** خلاصهٔ محاسبات لیست قطعات (ابعاد بر حسب میلی‌متر) */
  const stats = useMemo(() => {
    const valid = rows.filter(isValidPart);
    const totalQty = valid.reduce((sum, p) => sum + p.qty, 0);
    const totalAreaM2 =
      valid.reduce((sum, p) => sum + p.length * p.width * p.qty, 0) / 1_000_000;
    // متراژ تقریبی: ورودی عددی ۰/۱/۲ — تعداد لبه‌های دارای عملیات × طول همان محور
    const bandMeters =
      valid.reduce(
        (sum, p) =>
          sum +
          p.qty * (Number(p.bandLength) * p.length + Number(p.bandWidth) * p.width),
        0,
      ) / 1000;
    const grooveMeters =
      valid.reduce(
        (sum, p) =>
          sum +
          p.qty * (Number(p.grooveLength) * p.length + Number(p.grooveWidth) * p.width),
        0,
      ) / 1000;
    const farsiEdges = valid.reduce(
      (sum, p) => sum + p.qty * (Number(p.farsiLength) + Number(p.farsiWidth)),
      0,
    );
    const incomplete = rows.filter(
      (p) => !isEmptyPart(p) && !isValidPart(p),
    ).length;
    return {
      rowCount: valid.length,
      totalQty,
      totalAreaM2,
      bandMeters,
      grooveMeters,
      farsiEdges,
      incomplete,
    };
  }, [rows]);

  return (
    <div className="min-h-screen">
      {/* سربرگ نرم‌افزار: لوگو و سازنده (راست) — مدیریت پروژه‌ها (چپ) */}
      <header className="sticky top-0 z-30 bg-slate-900/95 text-white shadow-md backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
          {/* سمت راست: لوگو و نام نرم‌افزار */}
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-600 text-white shadow-inner">
              <LogoIcon />
            </span>
            <div className="leading-tight">
              <h1 className="text-lg font-black tracking-tight">
                <span dir="ltr" className="inline-block">A-Cut 2Dpro</span>
              </h1>
              <p className="mt-0.5 text-[11px] text-slate-400">
                بهینه‌سازی برش دوبعدی ورق — از ورود قطعات تا نقشه، DXF و لیبل
              </p>
            </div>
          </div>

          {/* اطلاعات سازنده */}
          <div className="hidden flex-col gap-0.5 border-s border-slate-700 ps-4 lg:flex">
            <span className="text-[10px] font-medium tracking-wide text-slate-500">طراحی و توسعه</span>
            <span className="text-sm font-extrabold leading-tight">عباس کروشاد</span>
            <span className="flex items-center gap-1.5 pt-0.5">
              <a
                href="https://instagram.com/Webxplusx"
                target="_blank"
                rel="noreferrer"
                title="اینستاگرام Webxplusx"
                className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-800 text-slate-300 ring-1 ring-slate-700 transition hover:bg-pink-600 hover:text-white"
              >
                <InstagramIcon className="h-3.5 w-3.5" />
              </a>
              <a
                href="https://t.me/Webxplusx"
                target="_blank"
                rel="noreferrer"
                title="تلگرام Webxplusx"
                className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-800 text-slate-300 ring-1 ring-slate-700 transition hover:bg-sky-500 hover:text-white"
              >
                <TelegramIcon className="h-3.5 w-3.5" />
              </a>
              <span dir="ltr" className="text-[11px] font-semibold text-slate-400">@Webxplusx</span>
            </span>
          </div>

          {/* سمت چپ: وضعیت پروژهٔ جاری + مدیریت پروژه‌ها */}
          <div className="ms-auto flex items-center gap-3">
            <div className="hidden leading-tight md:block">
              <p className="max-w-[190px] truncate text-xs font-extrabold" title={currentProjectName}>
                {currentProjectName}
              </p>
              <p className={`mt-0.5 text-[11px] font-semibold ${isDirty ? 'text-amber-300' : 'text-emerald-300'}`}>
                {saveNotice ??
                  (isDirty
                    ? '● تغییرات ذخیره‌نشده'
                    : currentProjectId
                      ? '✓ ذخیره‌شده'
                      : 'پیش‌نویس خودکار فعال')}
              </p>
            </div>
            <ProjectManager
              projects={projects}
              currentProjectId={currentProjectId}
              currentProjectName={currentProjectName}
              isDirty={isDirty}
              onSave={() => handleSaveProject(false)}
              onSaveAs={() => handleSaveProject(true)}
              onNew={handleNewProject}
              onOpen={handleOpenProject}
              onDelete={handleDeleteProject}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] space-y-4 px-4 py-4 sm:px-6">
        {/* نوار خلاصه */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard title="ردیف معتبر" value={faNumber.format(stats.rowCount)} hint="دارای ابعاد کامل" />
          <StatCard title="مجموع قطعات" value={faNumber.format(stats.totalQty)} hint="با احتساب تعداد هر ردیف" />
          <StatCard title="مساحت کل" value={`${faDecimal.format(stats.totalAreaM2)} m²`} hint="متر مربع" />
          <StatCard
            title="نوار لبه (تقریبی)"
            value={`${faDecimal.format(stats.bandMeters)} m`}
            hint="بر مبنای انتخاب ۰/۱/۲ لبه"
            accent="text-teal-700"
          />
          <StatCard
            title="لبهٔ فارسی ۴۵°"
            value={faNumber.format(stats.farsiEdges)}
            hint="لبه — روی نقشه: خط ممتد مشکی + 45°"
            accent="text-rose-700"
          />
          <StatCard
            title="شیار (تقریبی)"
            value={`${faDecimal.format(stats.grooveMeters)} m`}
            hint="متر طول شیار ورق ۳ میل"
            accent="text-amber-700"
          />
        </section>

        {stats.incomplete > 0 && (
          <p className="rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-800 ring-1 ring-rose-200">
            ⚠ {faNumber.format(stats.incomplete)} ردیف ناقص است (نام یا ابعاد آن کامل نشده) و در
            محاسبات بالا لحاظ نشده است.
          </p>
        )}

        {/* راهنمای ناوبری کیبورد */}
        <section className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-2xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-slate-300/70">
          <span className="font-extrabold text-slate-700">⌨️ جریان ورود سریع با کیبورد:</span>
          <FlowChip label="نام قطعه" first />
          <EnterKey />
          <FlowChip label="طول" />
          <EnterKey />
          <FlowChip label="عرض" />
          <EnterKey />
          <FlowChip label="تعداد" />
          <EnterKey />
          <FlowChip label="ردیف جدید ✓" highlight />
          <span className="ms-auto text-xs text-slate-500">
            جهت‌نمای <Kbd>↑</Kbd> <Kbd>↓</Kbd> بین ردیف‌ها حرکت می‌کند — ارقام فارسی هم پذیرفته می‌شوند.
          </span>
        </section>

        {/* فاز ۲: تنظیمات صفحهٔ خام + محاسبهٔ چیدمان */}
        <LayoutPanel
          parts={rows}
          settings={settings}
          onSettingsChange={setSettings}
          layoutState={layoutState}
          onLayoutStateChange={setLayoutState}
        />

        {/* جدول اصلی */}
        <DataEntryTable
          rows={rows}
          setRows={setRows}
          activeId={activeId}
          onActiveChange={setActiveId}
        />

        {/* پیش‌نمایش + راهنمای علائم */}
        <section className="grid gap-4 lg:grid-cols-5">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-300/70 lg:col-span-3">
            <h2 className="mb-1 flex items-center justify-between text-sm font-extrabold text-slate-800">
              پیش‌نمایش لبه‌های ردیف فعال
              <span className="text-xs font-medium text-slate-400">
                {activePart ? `«${activePart.name.trim() || 'بدون نام'}»` : ''}
              </span>
            </h2>
            <PartPreview part={activePart} />
            <p className="mt-1 text-center text-xs leading-6 text-slate-500">
              در <strong className="text-slate-700">فاز ۳ (نقشهٔ برش)</strong> لبه‌های فارسی دقیقاً
              رسم می‌شوند: <span className="font-bold text-slate-900">خط ممتد مشکی + مثلث پر + برچسب 45°</span>
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-300/70 lg:col-span-2">
            <h2 className="mb-3 text-sm font-extrabold text-slate-800">راهنمای علائم</h2>
            <ul className="space-y-3 text-sm leading-6">
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-100 ring-1 ring-teal-200">
                  <BandIcon active className="h-5 w-5" />
                </span>
                <p>
                  <strong className="text-teal-800">نوار (لبه‌چسب PVC)</strong>
                  <span className="text-slate-500"> — </span>
                  <span dir="ltr" className="text-slate-500">Edge Banding</span>
                  <br />
                  <span className="text-slate-600">در پیش‌نمایش ردیف خط سبزآبی دارد؛ در نقشهٔ چاپی سیاه‌وسفید با برچسب خوانای «PVC» در امتداد همان لبه نشان داده می‌شود.</span>
                </p>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100 ring-1 ring-rose-200">
                  <FarsiIcon active className="h-5 w-5" />
                </span>
                <p>
                  <strong className="text-rose-800">فارسی (برش ۴۵°)</strong>
                  <span className="text-slate-500"> — </span>
                  <span dir="ltr" className="text-slate-500">Miter Cut</span>
                  <br />
                  <span className="text-slate-600">
                    کنار ورودی آن آیکون مثلث/خط مورب هست؛ روی نقشهٔ برش با خط ممتد مشکی، مثلث پر و برچسب{' '}
                    <strong className="text-slate-900">45°</strong> رندر می‌شود تا اپراتور متوجه شود.
                  </span>
                </p>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 ring-1 ring-amber-200">
                  <GrooveIcon active className="h-5 w-5" />
                </span>
                <p>
                  <strong className="text-amber-800">شیار</strong>
                  <span className="text-slate-500"> — برای جاگذاری ورق ۳ میلی‌متری (پشت‌بند)</span>
                  <br />
                  <span className="text-slate-600">در پیش‌نمایش خط‌چین کهربایی است؛ در نقشهٔ سیاه‌وسفید خط‌چین ضخیم مشکی را ۱۰ میلی‌متر داخل قطعه و ۱۰ میلی‌متر دور از گوشه‌ها می‌بینید.</span>
                </p>
              </li>
            </ul>
            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-6 text-slate-500 ring-1 ring-slate-200">
              مقدار هر محور: ۰ بدون عملیات، ۱ یک لبه و ۲ هر دو لبهٔ مقابل است. «طول» لبه‌های موازی
              با طول قطعه و «عرض» لبه‌های موازی با عرض را مشخص می‌کند.
            </p>
          </div>
        </section>

        <footer className="pb-4 pt-1 text-center text-xs leading-6 text-slate-500">
          <span dir="ltr">A-Cut 2Dpro</span> — طراحی و توسعه: <strong className="text-slate-700">عباس کروشاد</strong>
          {' · '}
          <a href="https://instagram.com/Webxplusx" target="_blank" rel="noreferrer" className="font-semibold text-slate-600 transition hover:text-pink-600">اینستاگرام</a>
          {' / '}
          <a href="https://t.me/Webxplusx" target="_blank" rel="noreferrer" className="font-semibold text-slate-600 transition hover:text-sky-600">تلگرام</a>{' '}
          <span dir="ltr">@Webxplusx</span>
          <br />
          پروژه‌ها روی همین دستگاه ذخیره می‌شوند و فضای کاری فعلی نیز به‌صورت خودکار نگه داشته می‌شود.
        </footer>
      </main>
    </div>
  );
}

/* ---------------- اجزای کوچک رابط ---------------- */

function StatCard({
  title,
  value,
  hint,
  accent = 'text-slate-800',
}: {
  title: string;
  value: string;
  hint: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-300/70">
      <p className="text-xs font-semibold text-slate-500">{title}</p>
      <p className={`mt-1 text-xl font-black tabular-nums ${accent}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-sans text-[11px] font-bold text-slate-700 shadow-[0_1px_0_#cbd5e1]">
      {children}
    </kbd>
  );
}

function EnterKey() {
  return (
    <span className="inline-flex items-center gap-1 text-slate-400" aria-hidden="true">
      <Kbd>Enter ↵</Kbd>
      <span className="text-base leading-none">←</span>
    </span>
  );
}

function FlowChip({
  label,
  highlight = false,
  first = false,
}: {
  label: string;
  highlight?: boolean;
  first?: boolean;
}) {
  return (
    <span
      className={`rounded-lg px-2.5 py-1 text-[13px] font-bold ring-1 ${
        highlight
          ? 'bg-emerald-100 text-emerald-800 ring-emerald-300'
          : first
            ? 'bg-sky-100 text-sky-900 ring-sky-300'
            : 'bg-slate-100 text-slate-700 ring-slate-200'
      }`}
    >
      {label}
    </span>
  );
}
