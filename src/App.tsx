import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import DataEntryTable from './components/DataEntryTable';
import InstallButton from './components/InstallButton';
import LayoutPanel, { type LayoutPage } from './components/LayoutPanel';
import ProjectManager from './components/ProjectManager';
import PartPreview from './components/PartPreview';
import ThemeToggle, { type AppTheme } from './components/ThemeToggle';
import UpdateToast from './components/UpdateToast';
import {
  BandIcon,
  FarsiIcon,
  GrooveIcon,
  InstagramIcon,
  LogoIcon,
  TelegramIcon,
} from './components/icons';
import {
  calculateCutDimensions,
  createPart,
  isEmptyPart,
  isValidPart,
  type CutPart,
} from './types/part';
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
import { loadWorkspaceDraft, saveWorkspaceDraft } from './storage/projects';
import {
  deleteProject,
  listProjects,
  migrateLegacyProjects,
  putProject,
} from './db/database';

const faNumber = new Intl.NumberFormat('fa-IR');
const faDecimal = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });

/** چهار صفحهٔ رابط — داشبورد، نقشه/لیبل، خروجی‌ها و راهنما */
type AppPage = LayoutPage | 'guide';
const THEME_STORAGE_KEY = 'acut_theme';

const PAGES: {
  id: AppPage;
  number: string;
  label: string;
  hint: string;
  color: string;
}[] = [
  { id: 'dashboard', number: '۱', label: 'داشبورد و تنظیمات', hint: 'ورق، تیغه، نوار و ورود قطعات', color: '#0ea5e9' },
  { id: 'drawing', number: '۲', label: 'نقشه و لیبل‌ها', hint: 'نقشهٔ برش و برچسب کارگاهی', color: '#8b5cf6' },
  { id: 'outputs', number: '۳', label: 'خروجی‌ها', hint: 'نتایج، چاپ، PDF و DXF', color: '#10b981' },
  { id: 'guide', number: '۴', label: 'راهنما', hint: 'قوانین محاسبه و راهنمای سریع', color: '#f59e0b' },
];

function getInitialTheme(): AppTheme {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export default function App() {
  // فضای کاری اولیه از پیش‌نویس خودکار بازیابی می‌شود (رفرش صفحه کار را از بین نمی‌برد)
  const [initialWorkspace] = useState(loadWorkspaceDraft);
  const [rows, setRows] = useState<CutPart[]>(initialWorkspace.parts);
  const [activeId, setActiveId] = useState<string | null>(
    () => (initialWorkspace.parts.find(isEmptyPart) ?? initialWorkspace.parts[0])?.id ?? null,
  );
  const [settings, setSettings] = useState<LayoutSettings>(initialWorkspace.settings);
  const [layoutState, setLayoutState] = useState<LayoutState | null>(initialWorkspace.layoutState);
  const [activePage, setActivePage] = useState<AppPage>('dashboard');
  const [theme, setTheme] = useState<AppTheme>(getInitialTheme);

  // --- مدیریت پروژه‌ها — ذخیره در IndexedDB (Dexie) ---
  const [projects, setProjects] = useState<Project[]>([]);
  const [dbReady, setDbReady] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(initialWorkspace.projectId);
  const [currentProjectName, setCurrentProjectName] = useState(initialWorkspace.projectName);
  const [baselineSignature, setBaselineSignature] = useState(initialWorkspace.baselineSignature);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const workspaceSignature = useMemo(
    () => computeWorkspaceSignature(rows, settings, currentProjectName),
    [rows, settings, currentProjectName],
  );
  const isDirty = workspaceSignature !== baselineSignature;

  // اعمال تم روی <html> و نگه‌داری آن برای اجرای بعدی
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // اگر localStorage در دسترس نباشد، فقط تم همین اجرا اعمال می‌شود
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', theme === 'dark' ? '#060c17' : '#0e7490');
  }, [theme]);

  // با عوض‌شدن صفحه، از بالای محتوا شروع کنیم (تجربهٔ موبایل بهتر)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activePage]);

  // بارگذاری دیتابیس + مهاجرت داده‌های قدیمی localStorage
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const migratedCount = await migrateLegacyProjects();
        const all = await listProjects();
        if (cancelled) return;
        setProjects(all);
        if (migratedCount > 0) {
          setSaveNotice(
            `${migratedCount.toLocaleString('fa-IR')} پروژهٔ قدیمی به دیتابیس مرورگر منتقل شد ✓`,
          );
        }
      } catch {
        // IndexedDB در دسترس نیست (حالت خصوصی و ...): با فهرست خالی کار می‌کنیم
      } finally {
        if (!cancelled) setDbReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // پیش‌نویس خودکار فضای کاری (فایل موقت — همچنان در localStorage)
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
    const projectSettings = { ...DEFAULT_LAYOUT_SETTINGS, ...project.settings };
    setRows(parts);
    setSettings(projectSettings);
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
    setBaselineSignature(computeWorkspaceSignature(parts, projectSettings, project.name));
  };

  const confirmDiscardIfDirty = (action: string): boolean =>
    !isDirty ||
    window.confirm(
      `پروژهٔ فعلی («${currentProjectName}») تغییرات ذخیره‌نشده دارد. با ${action} این تغییرات از دست می‌رود. ادامه می‌دهید؟`,
    );

  const handleSaveProject = async (saveAs = false) => {
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
    try {
      // ذخیرهٔ ناهمگام در IndexedDB
      await putProject(project);
    } catch {
      window.alert('ذخیره انجام نشد: دیتابیس مرورگر در دسترس نیست یا پر است. چند پروژهٔ قدیمی را حذف کنید.');
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

  const handleDeleteProject = async (project: Project) => {
    if (!window.confirm(`پروژهٔ «${project.name}» حذف شود؟ این عمل قابل بازگشت نیست.`)) return;
    try {
      await deleteProject(project.id);
    } catch {
      window.alert('حذف انجام نشد: دیتابیس مرورگر در دسترس نیست.');
      return;
    }
    const next = projects.filter((p) => p.id !== project.id);
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

  /** خلاصهٔ محاسبات لیست قطعات — مساحت برش با کسر ضخامت نوار محاسبه می‌شود */
  const stats = useMemo(() => {
    const valid = rows.filter(isValidPart);
    const totalQty = valid.reduce((sum, p) => sum + p.qty, 0);
    const totalAreaM2 =
      valid.reduce((sum, p) => {
        const cut = calculateCutDimensions(p, settings.bandThickness);
        return sum + Math.max(0, cut.length) * Math.max(0, cut.width) * p.qty;
      }, 0) / 1_000_000;
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
    const incomplete = rows.filter((p) => !isEmptyPart(p) && !isValidPart(p)).length;
    return {
      rowCount: valid.length,
      totalQty,
      totalAreaM2,
      bandMeters,
      grooveMeters,
      farsiEdges,
      incomplete,
    };
  }, [rows, settings.bandThickness]);

  // تا دیتابیس بارگذاری و مهاجرت انجام شود، رابط نمایش داده نمی‌شود
  if (!dbReady) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--bg)] px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-14 w-14 animate-spin rounded-full border-4 border-[var(--accent)] border-t-transparent" />
          <p className="text-lg font-extrabold text-[var(--text)]">
            در حال آماده‌سازی دیتابیس پروژه‌ها…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* سربرگ نرم‌افزار: لوگو، وضعیت پروژه، تم، نصب و مدیریت پروژه‌ها */}
      <header className="app-header sticky top-0 z-40">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-600 text-white shadow-lg">
              <LogoIcon className="h-8 w-8" />
            </span>
            <div className="leading-tight">
              <h1 className="text-xl font-black tracking-tight text-[var(--text)]">
                <span dir="ltr" className="inline-block">A-Cut 2Dpro</span>
              </h1>
              <p className="mt-0.5 text-[12px] font-bold text-muted">
                بهینه‌سازی برش دوبعدی ورق — داشبورد، نقشه، لیبل و خروجی
              </p>
            </div>
          </div>

          <div className="hidden flex-col gap-0.5 border-s-2 border-[var(--border)] ps-4 lg:flex">
            <span className="text-[11px] font-extrabold tracking-wide text-subtle">طراحی و توسعه</span>
            <span className="text-base font-black leading-tight text-[var(--text)]">عباس کروشاد</span>
            <span className="flex items-center gap-1.5 pt-0.5">
              <a
                href="https://instagram.com/Webxplusx"
                target="_blank"
                rel="noreferrer"
                title="اینستاگرام Webxplusx"
                className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-800 text-slate-200 ring-1 ring-slate-600 transition hover:bg-pink-600 hover:text-white"
              >
                <InstagramIcon className="h-3.5 w-3.5" />
              </a>
              <a
                href="https://t.me/Webxplusx"
                target="_blank"
                rel="noreferrer"
                title="تلگرام Webxplusx"
                className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-800 text-slate-200 ring-1 ring-slate-600 transition hover:bg-sky-500 hover:text-white"
              >
                <TelegramIcon className="h-3.5 w-3.5" />
              </a>
              <span dir="ltr" className="text-[11px] font-bold text-subtle">@Webxplusx</span>
            </span>
          </div>

          <div className="ms-auto flex flex-wrap items-center gap-2.5">
            <div className="hidden leading-tight md:block">
              <p className="max-w-[210px] truncate text-sm font-black text-[var(--text)]" title={currentProjectName}>
                {currentProjectName}
              </p>
              <p
                className={`mt-0.5 text-[11px] font-extrabold ${
                  isDirty ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'
                }`}
              >
                {saveNotice ??
                  (isDirty
                    ? '● تغییرات ذخیره‌نشده'
                    : currentProjectId
                      ? '✓ ذخیره‌شده'
                      : 'پیش‌نویس خودکار فعال')}
              </p>
            </div>
            <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} />
            <InstallButton />
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

      <main className="mx-auto max-w-[1500px] space-y-5 px-4 py-5 sm:px-6">
        {/* ناوبری چهار صفحه */}
        <nav aria-label="صفحه‌های برنامه" className="panel p-2 sm:p-3">
          <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {PAGES.map((page) => (
              <li key={page.id}>
                <button
                  type="button"
                  onClick={() => setActivePage(page.id)}
                  aria-current={activePage === page.id ? 'page' : undefined}
                  className="page-tab"
                  style={{ '--tab': page.color } as CSSProperties}
                >
                  <span className="page-tab-num">{page.number}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-base font-black leading-tight">{page.label}</span>
                    <span className="block truncate text-[11px] font-semibold text-muted">{page.hint}</span>
                  </span>
                  {activePage === page.id && (
                    <span className="ms-auto hidden shrink-0 rounded-full bg-[var(--tab)] px-2 py-0.5 text-[10px] font-black text-white sm:inline-block dark:text-slate-950">
                      فعال
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {activePage === 'dashboard' && (
          <>
            {/* نام پروژه */}
            <section className="panel p-4 sm:p-6" aria-labelledby="project-name-title">
              <div className="flex flex-wrap items-start gap-3">
                <div>
                  <span className="badge mb-2">پروژهٔ جاری</span>
                  <h2 id="project-name-title" className="panel-title">
                    نام پروژه و وضعیت ذخیره
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-muted">
                    این نام همراه قطعات و تنظیمات در دیتابیس همین مرورگر ذخیره می‌شود.
                  </p>
                </div>
                <span
                  className={`badge ms-auto ${
                    isDirty
                      ? 'border-amber-400/70 bg-amber-500/15 text-amber-800 dark:text-amber-200'
                      : 'border-emerald-400/70 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
                  }`}
                >
                  {isDirty ? '● ذخیره‌نشده' : '✓ ذخیره‌شده'}
                </span>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <label className="block">
                  <span className="field-label">نام پروژه</span>
                  <input
                    type="text"
                    value={currentProjectName}
                    onChange={(e) => setCurrentProjectName(e.target.value)}
                    placeholder="مثلاً: کابینت آشپزخانهٔ واحد ۳"
                    className="field-input text-right"
                    aria-label="نام پروژه"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveProject(false)}
                    className="btn btn-primary"
                  >
                    💾 ذخیرهٔ پروژه
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveProject(true)}
                    className="btn btn-secondary"
                  >
                    ذخیره با نام جدید
                  </button>
                </div>
              </div>
            </section>

            {/* نوار خلاصه */}
            <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="خلاصهٔ پروژه">
              <StatCard title="ردیف معتبر" value={faNumber.format(stats.rowCount)} hint="دارای ابعاد کامل" />
              <StatCard title="مجموع قطعات" value={faNumber.format(stats.totalQty)} hint="با احتساب تعداد هر ردیف" />
              <StatCard
                title="مساحت برش"
                value={`${faDecimal.format(stats.totalAreaM2)} m²`}
                hint="پس از کسر ضخامت نوار"
              />
              <StatCard
                title="نوار لبه"
                value={`${faDecimal.format(stats.bandMeters)} m`}
                hint="بر مبنای انتخاب ۰/۱/۲ لبه"
                accent="text-teal-700 dark:text-teal-300"
              />
              <StatCard
                title="لبهٔ فارسی ۴۵°"
                value={faNumber.format(stats.farsiEdges)}
                hint="لبه — روی نقشه: حرف «ف»"
                accent="text-rose-700 dark:text-rose-300"
              />
              <StatCard
                title="شیار"
                value={`${faDecimal.format(stats.grooveMeters)} m`}
                hint="متر طول شیار ورق ۳ میل"
                accent="text-amber-700 dark:text-amber-300"
              />
            </section>

            {stats.incomplete > 0 && (
              <p className="rounded-xl border-2 border-amber-400/70 bg-amber-500/12 px-4 py-3 text-base font-bold text-amber-800 dark:text-amber-200">
                ⚠ {faNumber.format(stats.incomplete)} ردیف ناقص است (نام یا ابعاد آن کامل نشده) و در
                محاسبات بالا لحاظ نشده است.
              </p>
            )}

            {/* تنظیمات ورق، تیغه و نوار */}
            <LayoutPanel
              page="dashboard"
              parts={rows}
              settings={settings}
              onSettingsChange={setSettings}
              layoutState={layoutState}
              onLayoutStateChange={setLayoutState}
            />

            {/* بخش ورود قطعات — در همین صفحه */}
            <section className="space-y-3" aria-labelledby="parts-title">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <span className="badge mb-2">بخش قطعات</span>
                  <h2 id="parts-title" className="section-title">
                    ورود قطعات
                  </h2>
                </div>
                <p className="ms-auto max-w-2xl text-sm font-semibold leading-7 text-muted">
                  نام، طول، عرض و تعداد را وارد کنید؛ ستون‌های نوار، فارسی و شیار مقدار ۰/۱/۲
                  می‌گیرند. با Enter از هر فیلد به فیلد بعد و از «تعداد» به ردیف جدید می‌روید.
                </p>
              </div>

              {/* راهنمای ناوبری کیبورد */}
              <section className="panel flex flex-wrap items-center gap-x-2 gap-y-2 px-4 py-3">
                <span className="text-base font-extrabold text-[var(--text)]">⌨️ جریان ورود سریع:</span>
                <FlowChip label="نام قطعه" first />
                <EnterKey />
                <FlowChip label="طول" />
                <EnterKey />
                <FlowChip label="عرض" />
                <EnterKey />
                <FlowChip label="تعداد" />
                <EnterKey />
                <FlowChip label="ردیف جدید ✓" highlight />
                <span className="ms-auto text-sm font-semibold text-muted">
                  جهت‌نمای <Kbd>↑</Kbd> <Kbd>↓</Kbd> بین ردیف‌ها حرکت می‌کند — ارقام فارسی هم پذیرفته می‌شوند.
                </span>
              </section>

              <DataEntryTable
                rows={rows}
                setRows={setRows}
                activeId={activeId}
                onActiveChange={setActiveId}
              />
            </section>

            {/* پیش‌نمایش + راهنمای علائم */}
            <section className="grid gap-4 lg:grid-cols-5">
              <div className="panel p-4 sm:p-5 lg:col-span-3">
                <h2 className="flex flex-wrap items-center justify-between gap-2 text-xl font-black text-[var(--text)]">
                  پیش‌نمایش لبه‌های ردیف فعال
                  <span className="badge text-xs">
                    {activePart ? `«${activePart.name.trim() || 'بدون نام'}»` : ''}
                  </span>
                </h2>
                <PartPreview
                  part={activePart}
                  bandThickness={settings.bandThickness}
                  sheetColor={settings.sheetColor}
                  bandColor={settings.bandColor}
                />
                <p className="mt-2 text-center text-sm font-semibold leading-7 text-muted">
                  در نقشهٔ برش همین عملیات روی خودِ لبه علامت می‌خورد. ابعاد برش پس از کسر
                  ضخامت نوار/استریپ ({faNumber.format(settings.bandThickness)} mm) در پیش‌نمایش
                  نمایش داده می‌شود.
                </p>
              </div>

              <div className="panel p-4 sm:p-5 lg:col-span-2">
                <h2 className="mb-3 text-xl font-black text-[var(--text)]">راهنمای علائم</h2>
                <ul className="space-y-3 text-base leading-7">
                  <li className="flex gap-3">
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 ring-2 ring-teal-300 dark:bg-teal-900/50 dark:ring-teal-600">
                      <BandIcon active className="h-5 w-5" />
                    </span>
                    <p>
                      <strong className="text-teal-800 dark:text-teal-200">نوار (لبه‌چسب PVC)</strong>
                      <span className="text-subtle" dir="ltr"> — Edge Banding</span>
                      <br />
                      <span className="text-muted">
                        در پیش‌نمایش خط {settings.bandColor} دارد؛ در نقشه با نوار رنگی روی همان
                        لبه و حرف «ن» کنارش نشان داده می‌شود.
                      </span>
                    </p>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 ring-2 ring-rose-300 dark:bg-rose-900/50 dark:ring-rose-600">
                      <FarsiIcon active className="h-5 w-5" />
                    </span>
                    <p>
                      <strong className="text-rose-800 dark:text-rose-200">فارسی (برش ۴۵°)</strong>
                      <span className="text-subtle" dir="ltr"> — Miter Cut</span>
                      <br />
                      <span className="text-muted">
                        روی نقشه با خط دندانه‌ای (زیگزاگ ۴۵°) روی همان لبه و حرف «ف» کنارش
                        نشان داده می‌شود.
                      </span>
                    </p>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 ring-2 ring-amber-300 dark:bg-amber-900/50 dark:ring-amber-600">
                      <GrooveIcon active className="h-5 w-5" />
                    </span>
                    <p>
                      <strong className="text-amber-800 dark:text-amber-200">شیار</strong>
                      <span className="text-subtle"> — برای جاگذاری ورق ۳ میلی‌متری (پشت‌بند)</span>
                      <br />
                      <span className="text-muted">
                        در پیش‌نمایش خط‌چین کهربایی است؛ در نقشه با کانال دو خطی و حرف «ش»
                        کنارش نمایش داده می‌شود.
                      </span>
                    </p>
                  </li>
                </ul>
                <p className="info-box mt-4 text-sm font-semibold leading-7">
                  مقدار هر محور: ۰ بدون عملیات، ۱ یک لبه و ۲ هر دو لبهٔ مقابل است. «طول» لبه‌های
                  موازی با طول قطعه و «عرض» لبه‌های موازی با عرض را مشخص می‌کند.
                </p>
              </div>
            </section>
          </>
        )}

        {activePage === 'drawing' && (
          <LayoutPanel
            page="drawing"
            parts={rows}
            settings={settings}
            onSettingsChange={setSettings}
            layoutState={layoutState}
            onLayoutStateChange={setLayoutState}
          />
        )}

        {activePage === 'outputs' && (
          <LayoutPanel
            page="outputs"
            parts={rows}
            settings={settings}
            onSettingsChange={setSettings}
            layoutState={layoutState}
            onLayoutStateChange={setLayoutState}
          />
        )}

        {activePage === 'guide' && (
          <GuidePage bandThickness={settings.bandThickness} sheetColor={settings.sheetColor} bandColor={settings.bandColor} />
        )}

        <footer className="pb-5 pt-2 text-center text-sm leading-7 text-muted">
          <span dir="ltr" className="font-black text-[var(--text)]">A-Cut 2Dpro</span> — طراحی و توسعه:{' '}
          <strong className="text-[var(--text)]">عباس کروشاد</strong>
          {' · '}
          <a
            href="https://instagram.com/Webxplusx"
            target="_blank"
            rel="noreferrer"
            className="font-extrabold text-[var(--text)] transition hover:text-pink-600"
          >
            اینستاگرام
          </a>
          {' / '}
          <a
            href="https://t.me/Webxplusx"
            target="_blank"
            rel="noreferrer"
            className="font-extrabold text-[var(--text)] transition hover:text-sky-600"
          >
            تلگرام
          </a>{' '}
          <span dir="ltr">@Webxplusx</span>
          <br />
          پروژه‌ها در IndexedDB مرورگر ذخیره می‌شوند، فضای کاری خودکار نگه داشته می‌شود و
          نسخهٔ وب، اندروید و ویندوز از همین رابط چهارصفحه‌ای استفاده می‌کنند.
        </footer>
      </main>

      {/* اعلان «نسخهٔ جدید برنامه آماده است» (PWA — رویداد onNeedRefresh) */}
      <UpdateToast />
    </div>
  );
}

/* ---------------- صفحهٔ راهنما ---------------- */

function GuidePage({
  bandThickness,
  sheetColor,
  bandColor,
}: {
  bandThickness: number;
  sheetColor: string;
  bandColor: string;
}) {
  return (
    <div className="space-y-5">
      <section className="panel panel-accent p-4 sm:p-6">
        <span className="badge mb-2">صفحهٔ ۴ · راهنما</span>
        <h2 className="section-title">چهار صفحه، یک جریان کاری ساده</h2>
        <p className="mt-2 max-w-4xl text-base font-semibold leading-8 text-muted">
          رابط برنامه به چهار صفحهٔ مستقل تقسیم شده تا در کارگاه و روی موبایل، هر مرحله
          بدون شلوغی در دسترس باشد. داده‌ها بین صفحه‌ها مشترک‌اند و با هر تغییر، نتیجهٔ
          قبلی «قدیمی» علامت می‌خورد تا هرگز نقشهٔ اشتباه چاپ نشود.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['۱', 'داشبورد و تنظیمات', 'نام پروژه، ابعاد و رنگ ورق، اندازهٔ تیغه، ضخامت و رنگ نوار/استریپ و ورود قطعات.'],
          ['۲', 'نقشه و لیبل‌ها', 'نقشهٔ گرافیکی هر ورق با علائم لبه و لیبل‌های کارگاهی قطعات.'],
          ['۳', 'خروجی‌ها', 'خلاصهٔ نتایج، چاپ/PDF نقشه و لیست قطعات، PDF لیبل و فایل DXF برای CNC.'],
          ['۴', 'راهنما', 'قوانین محاسبه، معنی علائم و نکته‌های کارگاهی.'],
        ].map(([number, title, text]) => (
          <article key={number} className="stat-card">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface-3)] text-xl font-black">
              {number}
            </span>
            <h3 className="mt-3 text-lg font-black text-[var(--text)]">{title}</h3>
            <p className="mt-1 text-sm font-semibold leading-7 text-muted">{text}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-4 sm:p-5">
          <h3 className="panel-title">📐 قانون کسر ضخامت نوار/استریپ</h3>
          <p className="mt-2 text-base font-semibold leading-8 text-muted">
            ضخامت نوار از بعد عمود بر لبهٔ نوارخورده کسر می‌شود. مثلاً اگر عرض قطعه{' '}
            <b dir="ltr" className="text-[var(--text)]">400 mm</b> باشد و یک لبهٔ موازی طول
            نوار شود، با ضخامت{' '}
            <b dir="ltr" className="text-[var(--text)]">{faNumber.format(bandThickness)} mm</b>،
            عرض برش{' '}
            <b dir="ltr" className="text-[var(--text)]">{faNumber.format(Math.max(0, 400 - bandThickness))} mm</b>{' '}
            خواهد بود. این محاسبه در چیدمان، نقشه، لیبل، DXF، مساحت و درصد پرت اعمال می‌شود.
          </p>
          <div className="info-box mt-3 text-sm font-semibold leading-7">
            نکته: خوراک تیغه (Kerf) از فضای باقی‌مانده/پرت کم می‌شود، نه از ابعاد قطعه؛ پس
            ابعاد نهایی قطعه دقیقاً همان چیزی است که بعد از کسر نوار محاسبه شده است.
          </div>
        </div>

        <div className="panel p-4 sm:p-5">
          <h3 className="panel-title">🎨 رنگ‌های انتخاب‌شده</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="panel-soft p-3">
              <p className="field-label mb-1">رنگ ورق</p>
              <div className="h-16 rounded-xl border-2 border-[var(--border)]" style={{ backgroundColor: sheetColor }} />
              <p dir="ltr" className="mt-2 text-center font-mono text-sm font-black">{sheetColor}</p>
            </div>
            <div className="panel-soft p-3">
              <p className="field-label mb-1">رنگ نوار/استریپ</p>
              <div className="h-16 rounded-xl border-2 border-[var(--border)]" style={{ backgroundColor: bandColor }} />
              <p dir="ltr" className="mt-2 text-center font-mono text-sm font-black">{bandColor}</p>
            </div>
          </div>
          <p className="mt-3 text-sm font-semibold leading-7 text-muted">
            رنگ‌ها فقط برای خوانایی روی صفحه استفاده می‌شوند؛ خروجی چاپی و DXF همچنان
            سیاه‌وسفید و مناسب کارگاه است. در حالت تاریک، متن‌ها با کنتراست بالا روی رنگ
            ورق انتخاب‌شده رسم می‌شوند.
          </p>
        </div>
      </section>

      <section className="panel p-4 sm:p-5">
        <h3 className="panel-title">✅ نکته‌های سریع کارگاه</h3>
        <ul className="mt-3 grid gap-2 text-base font-semibold leading-8 text-muted md:grid-cols-2">
          <li>• قبل از چاپ، از نشان «✓ نتیجه به‌روز» در صفحهٔ نقشه مطمئن شوید.</li>
          <li>• برای تغییر سریع ابعاد، از دکمه‌های اندازه‌های رایج ورق استفاده کنید.</li>
          <li>• اگر رگه/گرین چوب مهم است، «چرخش ۹۰ درجه» را خاموش کنید.</li>
          <li>• کد هر قطعه در نقشه، لیبل و DXF یکسان است (مثل S1-03).</li>
          <li>• روی موبایل و اپ نصب‌شده، دکمه‌های چاپ به دانلود PDF تبدیل می‌شوند.</li>
          <li>• پروژه‌ها در دیتابیس همین دستگاه ذخیره می‌شوند؛ از پروژه‌های مهم نسخهٔ پشتیبان بگیرید.</li>
        </ul>
      </section>
    </div>
  );
}

/* ---------------- اجزای کوچک رابط ---------------- */

function StatCard({
  title,
  value,
  hint,
  accent = 'text-[var(--text)]',
}: {
  title: string;
  value: string;
  hint: string;
  accent?: string;
}) {
  return (
    <div className="stat-card">
      <p className="stat-label">{title}</p>
      <p className={`stat-value ${accent}`}>{value}</p>
      <p className="stat-hint">{hint}</p>
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-md border-2 border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 font-sans text-xs font-black text-[var(--text)]">
      {children}
    </kbd>
  );
}

function EnterKey() {
  return (
    <span className="inline-flex items-center gap-1 text-subtle" aria-hidden="true">
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
      className={`rounded-lg border-2 px-2.5 py-1 text-sm font-black ${
        highlight
          ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
          : first
            ? 'border-sky-500/60 bg-sky-500/15 text-sky-800 dark:text-sky-200'
            : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]'
      }`}
    >
      {label}
    </span>
  );
}
