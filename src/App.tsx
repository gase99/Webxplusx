import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import AppHeader from './components/AppHeader';
import DataEntryTable from './components/DataEntryTable';
import LayoutPanel from './components/LayoutPanel';
import PartPreview from './components/PartPreview';
import ThemeToggle, { type AppTheme } from './components/ThemeToggle';
import UpdateToast from './components/UpdateToast';
import AppearanceSheet from './components/AppearanceSheet';
import PageNav from './components/PageNav';
import PageRail, { PageStepper } from './components/PageRail';
import { BandIcon, FarsiIcon, GrooveIcon } from './components/icons';
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
import { PAGES, getPageMeta, type AppPage } from './types/pages';
import { ACCENT_OPTIONS, HEADER_OPTIONS } from './uiPrefs';
import { loadWorkspaceDraft, saveWorkspaceDraft } from './storage/projects';
import { deleteProject, listProjects, migrateLegacyProjects, putProject } from './db/database';
import { applyUiPrefs, loadUiPrefs, saveUiPrefs, type UiPrefs } from './uiPrefs';

const faNumber = new Intl.NumberFormat('fa-IR');
const faDecimal = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });
const THEME_STORAGE_KEY = 'acut_theme';

function getInitialTheme(): AppTheme {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/**
 * A-Cut 2Dpro — رابط چهارصفحه‌ای
 * ----------------------------------------------------------------------
 * هر صفحه کاملاً مستقل است و فقط محتوای خودش را نشان می‌دهد:
 *   ۱ داشبورد (تنظیمات ظاهری + ورق و نوار + ورود قطعات)
 *   ۲ نقشه و لیبل
 *   ۳ خروجی‌ها
 *   ۴ راهنمای صفحه‌ها
 * داده‌ها (قطعات، تنظیمات پروژه و نتیجهٔ چیدمان) بین صفحه‌ها مشترک‌اند تا
 * هر مرحله بدون شلوغی انجام شود.
 */
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
  const [uiPrefs, setUiPrefs] = useState<UiPrefs>(loadUiPrefs);
  const [appearanceOpen, setAppearanceOpen] = useState(false);

  // --- مدیریت پروژه‌ها — ذخیره در IndexedDB (Dexie) ---
  const [projects, setProjects] = useState<Project[]>([]);
  const [dbReady, setDbReady] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(
    initialWorkspace.projectId,
  );
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

  // تنظیمات ظاهری (رنگ تأکید، نوار، گوشه‌ها، انیمیشن) روی <html> اعمال و ذخیره می‌شود
  useEffect(() => {
    applyUiPrefs(uiPrefs);
    saveUiPrefs(uiPrefs);
  }, [uiPrefs]);

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
      const input = window.prompt(
        saveAs ? 'نام نسخهٔ جدید پروژه:' : 'نام پروژه را وارد کنید:',
        suggested,
      );
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
      await putProject(project);
    } catch {
      window.alert(
        'ذخیره انجام نشد: دیتابیس مرورگر در دسترس نیست یا پر است. چند پروژهٔ قدیمی را حذف کنید.',
      );
      return;
    }
    setProjects(next);
    setCurrentProjectId(id);
    setCurrentProjectName(name);
    setBaselineSignature(computeWorkspaceSignature(rows, settings, name));
    setSaveNotice(`پروژهٔ «${name}» ذخیره شد ✓`);
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
      setCurrentProjectId(null);
      setBaselineSignature('__unsaved__');
    }
    setSaveNotice(`پروژهٔ «${project.name}» حذف شد`);
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
    const bandMeters =
      valid.reduce(
        (sum, p) => sum + p.qty * (Number(p.bandLength) * p.length + Number(p.bandWidth) * p.width),
        0,
      ) / 1000;
    const grooveMeters =
      valid.reduce(
        (sum, p) =>
          sum + p.qty * (Number(p.grooveLength) * p.length + Number(p.grooveWidth) * p.width),
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

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => b.updatedAt - a.updatedAt),
    [projects],
  );

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

  /**
   * هر صفحه فقط محتوای خودش را رندر می‌کند — چیزی از صفحهٔ دیگر قاطی نمی‌شود.
   * (تابع است تا فقط همان صفحهٔ فعال ساخته شود، نه هر چهار صفحه در هر رندر.)
   */
  const renderPage = (): ReactNode => {
    switch (activePage) {
      case 'dashboard':
        return (
          <DashboardPage
            theme={theme}
            uiPrefs={uiPrefs}
            onThemeChange={setTheme}
            onUiPrefsChange={setUiPrefs}
            onOpenAppearance={() => setAppearanceOpen(true)}
            rows={rows}
            setRows={setRows}
            activeId={activeId}
            onActiveChange={setActiveId}
            settings={settings}
            onSettingsChange={setSettings}
            layoutState={layoutState}
            onLayoutStateChange={setLayoutState}
            stats={stats}
            activePart={activePart}
            projectName={currentProjectName}
            onProjectNameChange={setCurrentProjectName}
            isDirty={isDirty}
            currentProjectId={currentProjectId}
            projects={sortedProjects}
            onSave={() => void handleSaveProject(false)}
            onSaveAs={() => void handleSaveProject(true)}
            onNew={handleNewProject}
            onOpen={handleOpenProject}
            onDelete={handleDeleteProject}
            onNavigate={setActivePage}
          />
        );
      case 'drawing':
        return (
          <DrawingPage
            rows={rows}
            settings={settings}
            onSettingsChange={setSettings}
            layoutState={layoutState}
            onLayoutStateChange={setLayoutState}
            onNavigate={setActivePage}
          />
        );
      case 'outputs':
        return (
          <OutputsPage
            rows={rows}
            settings={settings}
            onSettingsChange={setSettings}
            layoutState={layoutState}
            onLayoutStateChange={setLayoutState}
            onNavigate={setActivePage}
          />
        );
      case 'guide':
        return (
          <GuidePage
            bandThickness={settings.bandThickness}
            sheetColor={settings.sheetColor}
            bandColor={settings.bandColor}
            onNavigate={setActivePage}
          />
        );
    }
  };

  return (
    <div className={`app-shell app-page-${activePage} flex min-h-screen flex-col`}>
      <AppHeader
        page={activePage}
        projectName={currentProjectName}
        isDirty={isDirty}
        theme={theme}
        uiPrefs={uiPrefs}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onNavigate={setActivePage}
        onOpenSettings={() => setAppearanceOpen(true)}
        onOpenProjects={() => {
          setActivePage('dashboard');
          window.setTimeout(() => {
            document
              .getElementById('saved-projects')
              ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const details = document.getElementById('saved-projects');
            if (details instanceof HTMLDetailsElement) details.open = true;
          }, 120);
        }}
        onSetAccent={(accent) => setUiPrefs((prev) => ({ ...prev, accent }))}
        onToggleRing={() => setUiPrefs((prev) => ({ ...prev, ring: !prev.ring }))}
        onToggleMotion={() =>
          setUiPrefs((prev) => ({
            ...prev,
            motion: prev.motion === 'full' ? 'soft' : prev.motion === 'soft' ? 'off' : 'full',
          }))
        }
      />

      <main className="mx-auto w-full max-w-[1500px] flex-1 space-y-5 px-4 pb-44 pt-4 sm:px-6 sm:pb-40">
        {/* تب‌های چهار صفحه — بالای همهٔ صفحه‌ها */}
        <PageNav activePage={activePage} onNavigate={setActivePage} />

        {/* محتوای همان صفحه (کلید = شناسهٔ صفحه، تا انیمیشن ورود هر صفحه اجرا شود) */}
        <div key={activePage} className="page-enter space-y-5">
          {renderPage()}
        </div>

        {saveNotice && (
          <p className="save-toast" role="status">
            {saveNotice}
          </p>
        )}
      </main>

      <PageRail activePage={activePage} onNavigate={setActivePage} />

      <AppearanceSheet
        open={appearanceOpen}
        theme={theme}
        uiPrefs={uiPrefs}
        onChange={setUiPrefs}
        onThemeChange={setTheme}
        onClose={() => setAppearanceOpen(false)}
      />

      {/* اعلان «نسخهٔ جدید برنامه آماده است» (PWA — رویداد onNeedRefresh) */}
      <UpdateToast />
    </div>
  );
}

/* ================================================================== */
/*  صفحهٔ ۱ — داشبورد و تنظیمات                                        */
/* ================================================================== */

function DashboardPage({
  theme,
  uiPrefs,
  onThemeChange,
  onUiPrefsChange,
  onOpenAppearance,
  rows,
  setRows,
  activeId,
  onActiveChange,
  settings,
  onSettingsChange,
  layoutState,
  onLayoutStateChange,
  stats,
  activePart,
  projectName,
  onProjectNameChange,
  isDirty,
  currentProjectId,
  projects,
  onSave,
  onSaveAs,
  onNew,
  onOpen,
  onDelete,
  onNavigate,
}: {
  theme: AppTheme;
  uiPrefs: UiPrefs;
  onThemeChange: (theme: AppTheme) => void;
  onUiPrefsChange: (prefs: UiPrefs) => void;
  onOpenAppearance: () => void;
  rows: CutPart[];
  setRows: Dispatch<SetStateAction<CutPart[]>>;
  activeId: string | null;
  onActiveChange: (id: string) => void;
  settings: LayoutSettings;
  onSettingsChange: (settings: LayoutSettings) => void;
  layoutState: LayoutState | null;
  onLayoutStateChange: (state: LayoutState | null) => void;
  stats: {
    rowCount: number;
    totalQty: number;
    totalAreaM2: number;
    bandMeters: number;
    grooveMeters: number;
    farsiEdges: number;
    incomplete: number;
  };
  activePart: CutPart | null;
  projectName: string;
  onProjectNameChange: (name: string) => void;
  isDirty: boolean;
  currentProjectId: string | null;
  projects: Project[];
  onSave: () => void;
  onSaveAs: () => void;
  onNew: () => void;
  onOpen: (project: Project) => void;
  onDelete: (project: Project) => void;
  onNavigate: (page: AppPage) => void;
}) {
  return (
    <>
      {/* سربرگ صفحه — «کنتراست نوشته‌ها بالا» */}
      <section className="panel p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0">
            <span className="page-chip" style={{ '--chip': '#0ea5e9' } as CSSProperties}>
              صفحهٔ ۱ · داشبورد
            </span>
            <h2 className="page-heading">داشبورد و تنظیمات</h2>
            <p className="page-lede">
              تم و رنگ نوار، ابعاد ورق، اندازهٔ تیغه، ضخامت و رنگ نوار و ورود قطعات — همه در همین
              صفحه. صفحه‌های بعدی فقط نقشه و خروجی را نشان می‌دهند.
            </p>
          </div>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <span
              className={`badge ${isDirty ? 'badge-warn' : 'badge-ok'}`}
              title="وضعیت ذخیرهٔ پروژه"
            >
              {isDirty
                ? '● تغییرات ذخیره‌نشده'
                : currentProjectId
                  ? '✓ ذخیره‌شده'
                  : 'پیش‌نویس خودکار'}
            </span>
            <ThemeToggle
              theme={theme}
              onToggle={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
            />
            <button
              type="button"
              onClick={onOpenAppearance}
              className="btn btn-secondary accent-ring"
            >
              🎨 تم و نوار
            </button>
          </div>
        </div>
      </section>

      {/* تنظیمات تم، نوار بالا و رنگ‌ها — داخل خود داشبورد */}
      <section className="panel panel-accent p-4 sm:p-5" aria-labelledby="appearance-inline-title">
        <div className="flex flex-wrap items-start gap-2">
          <div>
            <h3 id="appearance-inline-title" className="panel-title">
              ظاهر داشبورد: تم، نوار بالا و رنگ دکمه‌ها
            </h3>
            <p className="mt-1 text-sm font-bold text-muted">
              تغییرها بلافاصله اعمال و در همین دستگاه ذخیره می‌شوند.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenAppearance}
            className="btn btn-secondary accent-ring ms-auto"
          >
            🎨 همهٔ تنظیمات ظاهری…
          </button>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="panel-soft p-3">
            <p className="field-label mb-2">تم برنامه</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onThemeChange('light')}
                aria-pressed={theme === 'light'}
                className={`btn flex-1 ${theme === 'light' ? 'btn-primary accent-ring' : 'btn-secondary'}`}
              >
                ☀️ روشن
              </button>
              <button
                type="button"
                onClick={() => onThemeChange('dark')}
                aria-pressed={theme === 'dark'}
                className={`btn flex-1 ${theme === 'dark' ? 'btn-primary accent-ring' : 'btn-secondary'}`}
              >
                🌙 تاریک
              </button>
            </div>
          </div>

          <div className="panel-soft p-3">
            <p className="field-label mb-2">رنگ نوار و دکمه‌ها</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {ACCENT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onUiPrefsChange({ ...uiPrefs, accent: option.id })}
                  aria-pressed={uiPrefs.accent === option.id}
                  title={option.label}
                  aria-label={`رنگ ${option.label}`}
                  className={`h-9 w-9 rounded-xl border-2 transition hover:scale-105 ${
                    uiPrefs.accent === option.id
                      ? 'border-[var(--text)] ring-2 ring-[var(--accent)]'
                      : 'border-[var(--border)]'
                  }`}
                  style={{
                    background: `linear-gradient(135deg, ${option.swatch[0]}, ${option.swatch[1]})`,
                  }}
                />
              ))}
              <span className="ms-1 text-xs font-black text-muted">
                {ACCENT_OPTIONS.find((option) => option.id === uiPrefs.accent)?.label}
              </span>
            </div>
          </div>

          <div className="panel-soft p-3">
            <p className="field-label mb-2">نوار بالای صفحه</p>
            <div className="grid grid-cols-2 gap-1.5">
              {HEADER_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onUiPrefsChange({ ...uiPrefs, header: option.id })}
                  aria-pressed={uiPrefs.header === option.id}
                  className={`rounded-xl border-2 px-2 py-1.5 text-xs font-black transition ${
                    uiPrefs.header === option.id
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]'
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--accent)]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="panel-soft p-3">
            <p className="field-label mb-2">هایلایت چرخان دکمه‌ها</p>
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={uiPrefs.ring}
                onChange={(e) => onUiPrefsChange({ ...uiPrefs, ring: e.target.checked })}
                className="h-5 w-5 accent-[var(--accent)]"
              />
              <span className="text-sm font-black text-[var(--text)]">
                حلقهٔ رنگی دور دکمه‌ها می‌چرخد
              </span>
            </label>
            <p className="mt-1 text-xs font-bold text-subtle">
              روی دکمه‌های اصلی (محاسبه، ذخیره، چاپ) و صفحهٔ فعال نمایش داده می‌شود.
            </p>
          </div>
        </div>
      </section>

      {/* پروژهٔ جاری و مدیریت پروژه‌ها */}
      <section className="panel p-4 sm:p-5" aria-labelledby="project-title">
        <div className="flex flex-wrap items-start gap-3">
          <div>
            <h3 id="project-title" className="panel-title">
              پروژهٔ جاری
            </h3>
            <p className="mt-1 text-sm font-bold text-muted">
              نام پروژه، ذخیره در دیتابیس همین مرورگر و بازکردن پروژه‌های قبلی.
            </p>
          </div>
          <span className={`badge ms-auto ${isDirty ? 'badge-warn' : 'badge-ok'}`}>
            {isDirty ? '● ذخیره‌نشده' : '✓ ذخیره‌شده'}
          </span>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="block">
            <span className="field-label">نام پروژه</span>
            <input
              type="text"
              value={projectName}
              onChange={(e) => onProjectNameChange(e.target.value)}
              placeholder="مثلاً: کابینت آشپزخانهٔ واحد ۳"
              className="field-input text-right"
              aria-label="نام پروژه"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onSave} className="btn btn-primary accent-ring">
              💾 ذخیرهٔ پروژه
            </button>
            <button type="button" onClick={onSaveAs} className="btn btn-secondary">
              ذخیره با نام جدید
            </button>
            <button type="button" onClick={onNew} className="btn btn-secondary">
              ＋ پروژهٔ جدید
            </button>
          </div>
        </div>

        <details
          id="saved-projects"
          className="mt-4 scroll-mt-28 rounded-2xl border-2 border-[var(--border)] bg-[var(--surface-2)] p-3"
        >
          <summary className="cursor-pointer text-sm font-black text-[var(--text)]">
            پروژه‌های ذخیره‌شده ({faNumber.format(projects.length)})
          </summary>
          {projects.length === 0 ? (
            <p className="mt-3 text-sm font-bold text-muted">
              هنوز پروژه‌ای ذخیره نشده است؛ با دکمهٔ «ذخیرهٔ پروژه» اولین پروژه ساخته می‌شود.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {projects.map((project) => {
                const isCurrent = project.id === currentProjectId;
                return (
                  <li
                    key={project.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--surface)] p-2.5 ring-1 ring-[var(--border)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-[var(--text)]">
                        {project.name}
                        {isCurrent && (
                          <span className="ms-2 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-black text-[var(--on-accent)]">
                            فعلی
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[11px] font-bold text-subtle">
                        {faNumber.format(project.parts.filter(isValidPart).length)} ردیف ·{' '}
                        {faNumber.format(
                          project.parts.filter(isValidPart).reduce((s, p) => s + p.qty, 0),
                        )}{' '}
                        قطعه
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isCurrent}
                      onClick={() => onOpen(project)}
                      className="btn btn-secondary px-3 py-1.5 text-xs"
                    >
                      {isCurrent ? 'باز است' : 'باز کردن'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(project)}
                      aria-label={`حذف پروژهٔ ${project.name}`}
                      className="btn btn-danger px-3 py-1.5 text-xs"
                    >
                      حذف
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </details>
      </section>

      {/* نوار خلاصه */}
      <section
        className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
        aria-label="خلاصهٔ پروژه"
      >
        <StatCard
          title="ردیف معتبر"
          value={faNumber.format(stats.rowCount)}
          hint="دارای ابعاد کامل"
        />
        <StatCard
          title="مجموع قطعات"
          value={faNumber.format(stats.totalQty)}
          hint="با احتساب تعداد"
        />
        <StatCard
          title="مساحت برش"
          value={`${faDecimal.format(stats.totalAreaM2)} m²`}
          hint="پس از کسر ضخامت نوار"
        />
        <StatCard
          title="نوار لبه"
          value={`${faDecimal.format(stats.bandMeters)} m`}
          hint="بر مبنای ۰/۱/۲ لبه"
          accent="text-teal-700 dark:text-teal-300"
        />
        <StatCard
          title="لبهٔ فارسی ۴۵°"
          value={faNumber.format(stats.farsiEdges)}
          hint="روی نقشه: حرف «ف»"
          accent="text-rose-700 dark:text-rose-300"
        />
        <StatCard
          title="شیار"
          value={`${faDecimal.format(stats.grooveMeters)} m`}
          hint="متر طول شیار"
          accent="text-amber-700 dark:text-amber-300"
        />
      </section>

      {stats.incomplete > 0 && (
        <p className="rounded-xl border-2 border-amber-500 bg-amber-100 px-4 py-3 text-base font-black text-amber-900 dark:bg-amber-950/60 dark:text-amber-100">
          ⚠ {faNumber.format(stats.incomplete)} ردیف ناقص است (نام یا ابعاد کامل نیست) و در محاسبات
          بالا لحاظ نشده است.
        </p>
      )}

      {/* تنظیمات ورق، تیغه و نوار + دکمهٔ محاسبه */}
      <LayoutPanel
        page="dashboard"
        parts={rows}
        settings={settings}
        onSettingsChange={onSettingsChange}
        layoutState={layoutState}
        onLayoutStateChange={onLayoutStateChange}
      />

      {/* ورود قطعات — فقط در همین صفحه */}
      <section className="space-y-3" aria-labelledby="parts-title">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <h2 id="parts-title" className="section-title">
              ورود قطعات
            </h2>
            <p className="mt-1 text-sm font-bold text-muted">
              با Enter از هر فیلد به فیلد بعد و از «تعداد» به ردیف جدید می‌روید؛ ارقام فارسی هم
              پذیرفته می‌شوند.
            </p>
          </div>
          <div className="ms-auto flex flex-wrap items-center gap-1.5 text-xs font-black">
            <span className="flow-chip flow-chip-sky">نام</span>
            <span className="text-subtle">↵</span>
            <span className="flow-chip flow-chip-sky">طول</span>
            <span className="text-subtle">↵</span>
            <span className="flow-chip flow-chip-sky">عرض</span>
            <span className="text-subtle">↵</span>
            <span className="flow-chip flow-chip-sky">تعداد</span>
            <span className="text-subtle">↵</span>
            <span className="flow-chip flow-chip-green">ردیف جدید ✓</span>
          </div>
        </div>

        <DataEntryTable
          rows={rows}
          setRows={setRows}
          activeId={activeId}
          onActiveChange={onActiveChange}
        />
      </section>

      {/* پیش‌نمایش ردیف فعال + راهنمای علائم */}
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
          <p className="mt-2 text-center text-sm font-bold leading-7 text-muted">
            ابعاد برش پس از کسر ضخامت نوار/استریپ ({faNumber.format(settings.bandThickness)} mm) در
            پیش‌نمایش نمایش داده می‌شود.
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
                <br />
                <span className="font-bold text-muted">
                  در پیش‌نمایش خط {settings.bandColor} دارد؛ در نقشه با نوار رنگی روی همان لبه و حرف
                  «ن» کنارش نشان داده می‌شود.
                </span>
              </p>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 ring-2 ring-rose-300 dark:bg-rose-900/50 dark:ring-rose-600">
                <FarsiIcon active className="h-5 w-5" />
              </span>
              <p>
                <strong className="text-rose-800 dark:text-rose-200">فارسی (برش ۴۵°)</strong>
                <br />
                <span className="font-bold text-muted">
                  خط دندانه‌ای ۴۵° روی همان لبه و حرف «ف» کنارش.
                </span>
              </p>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 ring-2 ring-amber-300 dark:bg-amber-900/50 dark:ring-amber-600">
                <GrooveIcon active className="h-5 w-5" />
              </span>
              <p>
                <strong className="text-amber-800 dark:text-amber-200">شیار</strong>
                <br />
                <span className="font-bold text-muted">
                  کانال دو خطی برای ورق ۳ میلی‌متری و حرف «ش» کنارش.
                </span>
              </p>
            </li>
          </ul>
          <p className="info-box mt-4 text-sm font-bold leading-7">
            مقدار هر محور: ۰ بدون عملیات، ۱ یک لبه و ۲ هر دو لبهٔ مقابل.
          </p>
        </div>
      </section>

      <PageStepper
        activePage="dashboard"
        onNavigate={onNavigate}
        extra={
          <span className="text-sm font-bold text-muted">قدم بعد: صفحهٔ ۲ — نقشهٔ برش و لیبل‌ها</span>
        }
      />
    </>
  );
}

/* ================================================================== */
/*  صفحهٔ ۲ — نقشه و لیبل‌ها                                           */
/* ================================================================== */

function DrawingPage({
  rows,
  settings,
  onSettingsChange,
  layoutState,
  onLayoutStateChange,
  onNavigate,
}: {
  rows: CutPart[];
  settings: LayoutSettings;
  onSettingsChange: (settings: LayoutSettings) => void;
  layoutState: LayoutState | null;
  onLayoutStateChange: (state: LayoutState | null) => void;
  onNavigate: (page: AppPage) => void;
}) {
  return (
    <>
      <section className="panel p-4 sm:p-5">
        <span className="page-chip" style={{ '--chip': '#8b5cf6' } as CSSProperties}>
          صفحهٔ ۲ · نقشه
        </span>
        <h2 className="page-heading">نقشهٔ برش و لیبل‌ها</h2>
        <p className="page-lede">
          در این صفحه فقط نقشهٔ گیلوتینی ورق‌ها و برچسب‌های کارگاهی دیده می‌شود. قطعات را در صفحهٔ ۱
          وارد کنید؛ خروجی چاپ و DXF در صفحهٔ ۳ است.
        </p>
      </section>

      <LayoutPanel
        page="drawing"
        parts={rows}
        settings={settings}
        onSettingsChange={onSettingsChange}
        layoutState={layoutState}
        onLayoutStateChange={onLayoutStateChange}
      />

      <PageStepper
        activePage="drawing"
        onNavigate={onNavigate}
        extra={<span className="text-sm font-bold text-muted">{getPageMeta('drawing').hint}</span>}
      />
    </>
  );
}

/* ================================================================== */
/*  صفحهٔ ۳ — خروجی‌ها                                                  */
/* ================================================================== */

function OutputsPage({
  rows,
  settings,
  onSettingsChange,
  layoutState,
  onLayoutStateChange,
  onNavigate,
}: {
  rows: CutPart[];
  settings: LayoutSettings;
  onSettingsChange: (settings: LayoutSettings) => void;
  layoutState: LayoutState | null;
  onLayoutStateChange: (state: LayoutState | null) => void;
  onNavigate: (page: AppPage) => void;
}) {
  return (
    <>
      <section className="panel p-4 sm:p-5">
        <span className="page-chip" style={{ '--chip': '#10b981' } as CSSProperties}>
          صفحهٔ ۳ · خروجی
        </span>
        <h2 className="page-heading">خروجی‌ها و چاپ</h2>
        <p className="page-lede">
          خلاصهٔ نتیجه، چاپ/PDF نقشه و لیست قطعات، PDF لیبل و فایل DXF برای CNC — فقط همین‌ها و بدون
          ورودی داده.
        </p>
      </section>

      <LayoutPanel
        page="outputs"
        parts={rows}
        settings={settings}
        onSettingsChange={onSettingsChange}
        layoutState={layoutState}
        onLayoutStateChange={onLayoutStateChange}
      />

      <PageStepper
        activePage="outputs"
        onNavigate={onNavigate}
        extra={
          <span className="text-sm font-bold text-muted">
            اگر نتیجه قدیمی است، دکمهٔ «محاسبه» را بزنید تا خروجی‌ها باز شوند.
          </span>
        }
      />
    </>
  );
}

/* ================================================================== */
/*  صفحهٔ ۴ — راهنمای صفحه‌ها                                           */
/* ================================================================== */

function GuidePage({
  bandThickness,
  sheetColor,
  bandColor,
  onNavigate,
}: {
  bandThickness: number;
  sheetColor: string;
  bandColor: string;
  onNavigate: (page: AppPage) => void;
}) {
  return (
    <>
      <section className="panel panel-accent p-4 sm:p-6">
        <span className="page-chip" style={{ '--chip': '#f59e0b' } as CSSProperties}>
          صفحهٔ ۴ · راهنما
        </span>
        <h2 className="page-heading">راهنمای صفحه‌ها</h2>
        <p className="page-lede">
          هر چیز در صفحهٔ خودش است: تنظیمات در داشبورد، نقشه در صفحهٔ ۲، خروجی‌ها در صفحهٔ ۳ و آموزش در
          همین صفحه. برای رفتن به هر صفحه، روی کارت همان صفحه بزنید.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PAGES.map((page) => (
          <button
            key={page.id}
            type="button"
            onClick={() => onNavigate(page.id)}
            className="stat-card accent-ring text-start transition hover:-translate-y-0.5 hover:border-[var(--accent)]"
          >
            <span
              className="flex h-11 w-11 items-center justify-center rounded-xl text-xl font-black text-white"
              style={{ backgroundColor: page.color }}
            >
              {page.number}
            </span>
            <h3 className="mt-3 text-lg font-black text-[var(--text)]">{page.title}</h3>
            <p className="mt-1 text-sm font-bold leading-7 text-muted">
              {PAGE_DESCRIPTIONS[page.id]}
            </p>
            <span className="mt-2 inline-block text-xs font-black text-[var(--accent)]">
              رفتن به این صفحه ←
            </span>
          </button>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-4 sm:p-5">
          <h3 className="panel-title">📐 قانون کسر ضخامت نوار/استریپ</h3>
          <p className="mt-2 text-base font-bold leading-8 text-muted">
            ضخامت نوار از بعد عمود بر لبهٔ نوارخورده کسر می‌شود. مثلاً اگر عرض قطعه{' '}
            <b dir="ltr" className="text-[var(--text)]">
              400 mm
            </b>{' '}
            باشد و یک لبهٔ موازی طول نوار شود، با ضخامت{' '}
            <b dir="ltr" className="text-[var(--text)]">
              {faNumber.format(bandThickness)} mm
            </b>
            ، عرض برش{' '}
            <b dir="ltr" className="text-[var(--text)]">
              {faNumber.format(Math.max(0, 400 - bandThickness))} mm
            </b>{' '}
            خواهد بود. این محاسبه در چیدمان، نقشه، لیبل، DXF، مساحت و درصد پرت اعمال می‌شود.
          </p>
          <div className="info-box mt-3 text-sm font-bold leading-7">
            خوراک تیغه (Kerf) از فضای باقی‌مانده/پرت کم می‌شود، نه از ابعاد قطعه.
          </div>
        </div>

        <div className="panel p-4 sm:p-5">
          <h3 className="panel-title">🎨 رنگ‌های انتخاب‌شده</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="panel-soft p-3">
              <p className="field-label mb-1">رنگ ورق</p>
              <div
                className="h-16 rounded-xl border-2 border-[var(--border)]"
                style={{ backgroundColor: sheetColor }}
              />
              <p dir="ltr" className="mt-2 text-center font-mono text-sm font-black">
                {sheetColor}
              </p>
            </div>
            <div className="panel-soft p-3">
              <p className="field-label mb-1">رنگ نوار/استریپ</p>
              <div
                className="h-16 rounded-xl border-2 border-[var(--border)]"
                style={{ backgroundColor: bandColor }}
              />
              <p dir="ltr" className="mt-2 text-center font-mono text-sm font-black">
                {bandColor}
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm font-bold leading-7 text-muted">
            رنگ‌ها فقط برای خوانایی روی صفحه‌اند؛ خروجی چاپی و DXF همچنان سیاه‌وسفید و مناسب کارگاه
            است.
          </p>
        </div>
      </section>

      <section className="panel p-4 sm:p-5">
        <h3 className="panel-title">✅ نکته‌های سریع کارگاه</h3>
        <ul className="mt-3 grid gap-2 text-base font-bold leading-8 text-muted md:grid-cols-2">
          <li>• قبل از چاپ، از نشان «✓ نتیجه به‌روز» در صفحهٔ نقشه مطمئن شوید.</li>
          <li>• برای تغییر سریع ابعاد، از دکمه‌های اندازه‌های رایج ورق استفاده کنید.</li>
          <li>• اگر رگه/گرین چوب مهم است، «چرخش ۹۰ درجه» را خاموش کنید.</li>
          <li>• کد هر قطعه در نقشه، لیبل و DXF یکسان است (مثل S1-03).</li>
          <li>• روی موبایل و اپ نصب‌شده، دکمه‌های چاپ به دانلود PDF تبدیل می‌شوند.</li>
          <li>• تنظیمات ظاهری (تم، رنگ نوار، گوشه‌ها) در منوی «⋮» بالای صفحه است.</li>
        </ul>
      </section>

      <PageStepper activePage="guide" onNavigate={onNavigate} />
    </>
  );
}

const PAGE_DESCRIPTIONS: Record<AppPage, string> = {
  dashboard:
    'نام پروژه، تم و رنگ نوار، ابعاد و رنگ ورق، اندازهٔ تیغه، ضخامت و رنگ نوار/استریپ و جدول ورود قطعات.',
  drawing:
    'نقشهٔ گرافیکی هر ورق خام با علائم لبه (نوار، فارسی ۴۵° و شیار) و لیبل‌های کارگاهی قطعات.',
  outputs:
    'خلاصهٔ نتایج، چاپ/PDF نقشه و لیست قطعات، PDF لیبل‌ها، فایل DXF برای CNC و برگهٔ کنترل تولید.',
  guide: 'همین صفحه: قوانین محاسبه، معنی علائم، رنگ‌ها و نکته‌های کارگاهی.',
};

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
