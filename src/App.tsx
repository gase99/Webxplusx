import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import BottomNav, { TABS, type AppTab } from './components/BottomNav';
import ErrorBoundary from './components/ErrorBoundary';
import UpdateToast from './components/UpdateToast';
import DashboardPage from './pages/DashboardPage';
import PartsPage from './pages/PartsPage';
import MapPage from './pages/MapPage';
import ResultsPage from './pages/ResultsPage';
import MorePage from './pages/MorePage';
import type { AppController, EngineView } from './pages/props';
import type { AppTheme } from './components/ThemeToggle';
import { createPart, isEmptyPart, type CutPart } from './types/part';
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
import { loadPackingSettings, savePackingSettings, type PackingSettings } from './storage/packingSettings';
import {
  deleteProject as deleteProjectDb,
  listProjects,
  migrateLegacyProjects,
  putProject,
  type DbError,
} from './db/database';
import { classifyDbError } from './db/errors';
import { useLayoutEngine } from './hooks/useLayoutEngine';
import LockScreen from './components/LockScreen';
import { isAppLocked, markLimitReached, recordTrialProjects } from './lib/license';
import { FREE_PROJECT_LIMIT } from './config/constants';
import { computePartsStats } from './lib/stats';
import { logger } from './lib/logger';
import { NOTICE_TIMEOUT_MS, STORAGE_KEYS } from './config/constants';
import { fa } from './i18n/fa';

/**
 * A-Cut 2Dpro — پوستهٔ برنامه
 * ===========================
 * بازآرایی رابط (نسخهٔ داشبوردی):
 *  - **بدون هیچ نوار بالایی**: سربرگ/هدر قدیمی (نام برنامه، لوگو، پروژه، تم،
 *    نصب، مدیریت پروژه) کاملاً حذف شده است. محتوا با padding ناحیهٔ امن
 *    (safe-area) از زیر نوار وضعیت اندروید شروع می‌شود.
 *  - **پنج صفحهٔ مستقل**: داشبورد، قطعات، نقشه، خروجی‌ها، بیشتر — با نوار
 *    ناوبری پایین (RTL) و حالت فعال.
 *  - **حالت مشترک**: قطعات/تنظیمات/نتیجه/الگوریتم در همین‌جا نگه داشته
 *    می‌شوند، پس جابه‌جایی بین زبانه‌ها چیزی را از دست نمی‌دهد.
 *  - **دکمهٔ بازگشت اندروید** (افزونهٔ رسمی @capacitor/app): هر جابه‌جایی
 *    زبانه یک ورودی در history می‌گذارد؛ دکمهٔ Back طبق تاریخچه عقب می‌رود
 *    و فقط در صفحهٔ داشبورد برنامه را می‌بندد (رفتار استاندارد اپ‌های بومی).
 *  - **Deep link**: آدرس `#/map` (و مشابه آن) در بازکردن/رفرش صفحه کار می‌کند.
 */

const THEME_STORAGE_KEY = STORAGE_KEYS.theme;

/** مسیر هر زبانه در hash برای deep-link و بازگشت با دکمهٔ Back */
const TAB_HASH: Record<AppTab, string> = {
  dashboard: '#/dashboard',
  parts: '#/parts',
  map: '#/map',
  results: '#/results',
  more: '#/more',
};

function tabFromHash(hash: string): AppTab | null {
  const clean = hash.replace(/^#\/?/, '').toLowerCase();
  const found = (Object.keys(TAB_HASH) as AppTab[]).find((tab) => tab === clean);
  return found ?? null;
}

function getInitialTheme(): AppTheme {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

const faNumber = new Intl.NumberFormat('fa-IR');

export default function App() {
  // فضای کاری اولیه از پیش‌نویس خودکار بازیابی می‌شود (رفرش صفحه کار را از بین نمی‌برد)
  const [initialWorkspace] = useState(loadWorkspaceDraft);
  const [rows, setRows] = useState<CutPart[]>(initialWorkspace.parts);
  const [activeId, setActiveId] = useState<string | null>(
    () => (initialWorkspace.parts.find(isEmptyPart) ?? initialWorkspace.parts[0])?.id ?? null,
  );
  const [settings, setSettingsState] = useState<LayoutSettings>(initialWorkspace.settings);
  const [layoutState, setLayoutState] = useState<LayoutState | null>(initialWorkspace.layoutState);
  const [tab, setTabState] = useState<AppTab>(() => tabFromHash(window.location.hash) ?? 'dashboard');
  const [theme, setTheme] = useState<AppTheme>(getInitialTheme);
  const [packing, setPacking] = useState<PackingSettings>(loadPackingSettings);

  // --- مدیریت پروژه‌ها — ذخیره در IndexedDB (Dexie) ---
  const [projects, setProjects] = useState<Project[]>([]);
  const [dbReady, setDbReady] = useState(false);
  // قفل لایسنس: null = در حال بررسی، true = قفل، false = آزاد
  const [locked, setLocked] = useState<boolean | null>(null);
  const [dbError, setDbError] = useState<DbError | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(initialWorkspace.projectId);
  const [currentProjectName, setCurrentProjectName] = useState(initialWorkspace.projectName);
  const [baselineSignature, setBaselineSignature] = useState(initialWorkspace.baselineSignature);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const workspaceSignature = useMemo(
    () => computeWorkspaceSignature(rows, settings, currentProjectName),
    [rows, settings, currentProjectName],
  );
  const isDirty = workspaceSignature !== baselineSignature;

  /** تنظیمات ورق/تیغه (نتیجهٔ قبلی «قدیمی» می‌ماند و دست‌نخورده نمایش داده می‌شود) */
  const setSettings = useCallback((next: LayoutSettings) => {
    setSettingsState(next);
  }, []);

  /* ---------------- محاسبهٔ مشترک (یک منبع حقیقت) ---------------- */

  const layoutSignatureOf = useCallback(
    () => computeLayoutSignature(rows, settings),
    [rows, settings],
  );

  const engineCore = useLayoutEngine({ layoutState, onLayoutStateChange: setLayoutState });

  const canCalculate = useMemo(
    () =>
      rows.some((row) => row.length > 0 && row.width > 0 && row.qty > 0) &&
      settings.stockLength > 0 &&
      settings.stockWidth > 0,
    [rows, settings.stockLength, settings.stockWidth],
  );

  const runCalculation = useCallback(() => {
    if (locked !== false) return;
    void engineCore.calculate({
      parts: rows,
      settings,
      selection: packing.selection,
      maxSheets: packing.maxSheets,
      signature: layoutSignatureOf(),
    });
  }, [locked, engineCore, rows, settings, packing.selection, packing.maxSheets, layoutSignatureOf]);

  const engine: EngineView = useMemo(
    () => ({
      result: engineCore.result,
      resultParts: engineCore.resultParts,
      isStale: engineCore.result !== null && engineCore.resultSignature !== layoutSignatureOf(),
      busy: engineCore.busy,
      progress: engineCore.progress,
      error: engineCore.error,
      warnings: engineCore.warnings,
      canCalculate,
      calculate: runCalculation,
      cancel: engineCore.cancel,
    }),
    [engineCore, canCalculate, runCalculation, layoutSignatureOf],
  );

  /* ---------------- ناوبری (تب + دکمهٔ بازگشت) ---------------- */

  const setTab = useCallback((next: AppTab) => {
    setTabState((current) => {
      if (current === next) return current;
      // ورودی تاریخچه تا دکمهٔ Back اندروید/مرورگر طبیعی کار کند
      try {
        window.history.pushState({ tab: next }, '', TAB_HASH[next]);
      } catch {
        // در WebViewهای محدود، history در دسترس نیست — ناوبری درون‌برنامه‌ای کار می‌کند
      }
      return next;
    });
  }, []);

  // همگام‌سازی با دکمهٔ Back/Forward مرورگر و deep-link
  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const fromHash = tabFromHash(window.location.hash);
      const fromState = (event.state as { tab?: AppTab } | null)?.tab;
      setTabState(fromHash ?? fromState ?? 'dashboard');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // دکمهٔ بازگشت سخت‌افزاری اندروید — افزونهٔ رسمی @capacitor/app.
  // (رویداد DOM قدیمی `backbutton` در Capacitor 8 شلیک نمی‌شود؛ هستهٔ Capacitor
  // هیچ مدیریت پیش‌فرضی برای Back ندارد و بدون این افزونه، Back برنامه را می‌بست.)
  // رفتار: در زبانه‌های غیر از داشبورد همان مسیر history را طی می‌کند و در
  // داشبورد برنامه بسته می‌شود (رفتار استاندارد اپ‌های بومی).
  useEffect(() => {
    let handle: PluginListenerHandle | undefined;
    let cancelled = false;
    const onAndroidBack = () => {
      if (tab === 'dashboard') {
        void CapacitorApp.exitApp(); // اجازهٔ بستن اپ در صفحهٔ اصلی
        return;
      }
      if (window.history.length > 1) window.history.back();
      else setTabState('dashboard');
    };
    void CapacitorApp.addListener('backButton', onAndroidBack).then((h) => {
      if (cancelled) void h.remove();
      else handle = h;
    });
    return () => {
      cancelled = true;
      void handle?.remove();
    };
  }, [tab]);

  useEffect(() => {
    // با عوض‌شدن صفحه از بالای محتوا شروع کنیم (تجربهٔ موبایل بهتر)
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [tab]);

  // پیام‌ها در صفحهٔ جاری در دسترس باشند (deep link با hash ناشناخته ⇒ داشبورد)
  useEffect(() => {
    if (!tabFromHash(window.location.hash)) {
      try {
        window.history.replaceState({ tab }, '', TAB_HASH[tab]);
      } catch {
        // نادیده می‌گیریم
      }
    }
  }, [tab]);

  /* ---------------- تم ---------------- */

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

  /* ---------------- ذخیرهٔ تنظیمات الگوریتم ---------------- */

  useEffect(() => {
    savePackingSettings(packing);
  }, [packing]);

  const setSelection = useCallback((selection: PackingSettings['selection']) => {
    setPacking((prev) => ({ ...prev, selection }));
  }, []);

  const setMaxSheets = useCallback((value: number) => {
    setPacking((prev) => ({ ...prev, maxSheets: Math.max(0, Math.floor(value)) }));
  }, []);

  const setAutoRecalculate = useCallback((value: boolean) => {
    setPacking((prev) => ({ ...prev, autoRecalculate: value }));
  }, []);

  /* ---------------- دیتابیس ---------------- */

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
      } catch (error) {
        if (cancelled) return;
        const dbFailure = classifyDbError(error);
        setDbError(dbFailure instanceof Error && 'userMessage' in dbFailure ? (dbFailure as DbError) : null);
        logger.warn('بارگذاری دیتابیس پروژه‌ها ناموفق بود', error);
      } finally {
        if (!cancelled) setDbReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // بررسی قفل لایسنس هنگام اجرا (بعد از بارگذاری پروژه‌ها)
  useEffect(() => {
    if (!dbReady) return;
    let cancelled = false;
    (async () => {
      // اگر کاربر از قبل ۳+ پروژه دارد و پرچم سقف ثبت نشده، ثبتش کن
      try {
        if (recordTrialProjects(projects.map(p => p.id)) >= FREE_PROJECT_LIMIT) markLimitReached();
      } catch { setLocked(true); return; }
      const isLocked = await isAppLocked();
      if (!cancelled) setLocked(isLocked);
    })();
    return () => {
      cancelled = true;
    };
  }, [dbReady, projects.length]);

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
    const timer = window.setTimeout(() => setSaveNotice(null), NOTICE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [saveNotice]);

  // محاسبهٔ خودکار (اختیاری) با debounce — فقط وقتی نتیجه قدیمی شده است
  const autoCalcTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!packing.autoRecalculate) return;
    if (!engineCore.result || !canCalculate) return;
    if (engineCore.resultSignature === layoutSignatureOf()) return;
    if (autoCalcTimer.current) window.clearTimeout(autoCalcTimer.current);
    autoCalcTimer.current = window.setTimeout(() => {
      runCalculation();
    }, 700);
    return () => {
      if (autoCalcTimer.current) window.clearTimeout(autoCalcTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packing.autoRecalculate, rows, settings, packing.selection, packing.maxSheets]);

  /* ---------------- عملیات پروژه ---------------- */

  const applyProject = (project: Project) => {
    const parts = project.parts.length > 0 ? cloneParts(project.parts) : [createPart()];
    const projectSettings = { ...DEFAULT_LAYOUT_SETTINGS, ...project.settings };
    setRows(parts);
    setSettingsState(projectSettings);
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

  const saveProject = useCallback(
    async (saveAs = false) => {
      if (locked !== false) return;
      const now = Date.now();
      let id = currentProjectId;
      let name = currentProjectName;
      let createdAt = projects.find((project) => project.id === id)?.createdAt ?? now;

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
        await putProject(project);
      } catch (error) {
        const dbFailure = classifyDbError(error);
        setDbError(dbFailure);
        setSaveNotice(null);
        window.alert(`ذخیره انجام نشد: ${dbFailure.userMessage}`);
        return;
      }
      setProjects(next);
      setCurrentProjectId(id);
      setCurrentProjectName(name);
      setBaselineSignature(computeWorkspaceSignature(rows, settings, name));
      setSaveNotice(`پروژهٔ «${name}» ذخیره شد ✓`);
      // رسیدن به سقف پروژه‌های رایگان ⇒ قفل برنامه (مگر لایسنس معتبر داشته باشد)
      if (recordTrialProjects(next.map(p => p.id)) >= FREE_PROJECT_LIMIT) {
        markLimitReached();
        setLocked(await isAppLocked());
      }
    },
    [locked, currentProjectId, currentProjectName, projects, rows, settings, layoutState],
  );

  const openProject = (project: Project) => {
    if (!confirmDiscardIfDirty('باز کردن پروژهٔ دیگر')) return;
    applyProject(project);
    setSaveNotice(`پروژهٔ «${project.name}» باز شد`);
  };

  const removeProject = async (project: Project) => {
    if (!window.confirm(`پروژهٔ «${project.name}» حذف شود؟ این عمل قابل بازگشت نیست.`)) return;
    try {
      await deleteProjectDb(project.id);
    } catch (error) {
      const dbFailure = classifyDbError(error);
      setDbError(dbFailure);
      window.alert(`حذف انجام نشد: ${dbFailure.userMessage}`);
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

  const newProject = () => {
    if (!confirmDiscardIfDirty('شروع پروژهٔ جدید')) return;
    const empty = [createPart()];
    const freshSettings = { ...DEFAULT_LAYOUT_SETTINGS };
    setRows(empty);
    setSettingsState(freshSettings);
    setLayoutState(null);
    setCurrentProjectId(null);
    setCurrentProjectName(UNTITLED_PROJECT_NAME);
    setActiveId(empty[0].id);
    setBaselineSignature(computeWorkspaceSignature(empty, freshSettings, UNTITLED_PROJECT_NAME));
    setSaveNotice('پروژهٔ جدید شروع شد');
  };

  /* ---------------- خلاصهٔ آماری ---------------- */

  const stats = useMemo(() => computePartsStats(rows, settings.bandThickness), [rows, settings.bandThickness]);

  const controller: AppController = useMemo(
    () => ({
      tab,
      setTab,
      rows,
      setRows,
      activeId,
      setActiveId,
      settings,
      setSettings,
      layoutState,
      setLayoutState,
      engine,
      stats,
      currentProjectName,
      setCurrentProjectName,
      currentProjectId,
      isDirty,
      saveNotice,
      projects,
      dbReady,
      dbError,
      clearDbError: () => setDbError(null),
      saveProject: (saveAs?: boolean) => void saveProject(saveAs),
      newProject,
      openProject,
      deleteProject: (project: Project) => void removeProject(project),
      packing,
      setSelection,
      setMaxSheets,
      setAutoRecalculate,
      theme,
      toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      tab,
      rows,
      activeId,
      settings,
      layoutState,
      engine,
      stats,
      currentProjectName,
      currentProjectId,
      isDirty,
      saveNotice,
      projects,
      dbReady,
      dbError,
      packing,
      theme,
    ],
  );

  // قفل لایسنس — تا بررسی کامل نشود، رابط نمایش داده نمی‌شود
  if (locked === null || !dbReady) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--bg)] px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-14 w-14 animate-spin rounded-full border-4 border-[var(--accent)] border-t-transparent" />
          <p className="text-lg font-extrabold text-[var(--text)]">{fa.common.loading}</p>
        </div>
      </div>
    );
  }

  if (locked) {
    return <LockScreen onUnlocked={() => setLocked(false)} />;
  }

  // تا دیتابیس بارگذاری و مهاجرت انجام شود، رابط نمایش داده نمی‌شود
  if (!dbReady) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--bg)] px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-14 w-14 animate-spin rounded-full border-4 border-[var(--accent)] border-t-transparent" />
          <p className="text-lg font-extrabold text-[var(--text)]">{fa.common.loading}</p>
        </div>
      </div>
    );
  }

  const badges: Partial<Record<AppTab, string>> = {
    parts: stats.rowCount > 0 ? faNumber.format(stats.rowCount) : undefined,
    map: engine.result ? faNumber.format(engine.result.summary.sheetCount) : undefined,
    results: engine.result && engine.isStale ? '!' : undefined,
  };

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        پرش به محتوای اصلی
      </a>

      {saveNotice && (
        <div className="notice-toast" role="status" aria-live="polite">
          {saveNotice}
        </div>
      )}

      <main id="main-content" className="app-content mx-auto w-full max-w-[1500px] px-3 pb-4 sm:px-6">
        <ErrorBoundary label={TABS.find((item) => item.id === tab)?.label}>
          {tab === 'dashboard' && <DashboardPage app={controller} />}
          {tab === 'parts' && <PartsPage app={controller} />}
          {tab === 'map' && <MapPage app={controller} />}
          {tab === 'results' && <ResultsPage app={controller} />}
          {tab === 'more' && <MorePage app={controller} />}
        </ErrorBoundary>

        {dbError && (
          <p className="mt-3 rounded-xl border-2 border-amber-400/70 bg-amber-500/12 px-3 py-2 text-xs font-bold text-amber-800 dark:text-amber-200">
            ⚠ {dbError.userMessage}
          </p>
        )}

        <footer className="mt-4 px-1 text-center text-[11px] font-semibold leading-6 text-muted">
          <span dir="ltr" className="font-black text-[var(--text)]">A-Cut 2Dpro</span> — {fa.app.designerRole}:{' '}
          <strong className="text-[var(--text)]">{fa.app.designer}</strong> ·{' '}
          <span dir="ltr">@Webxplusx</span>
        </footer>
      </main>

      <BottomNav active={tab} onChange={setTab} badges={badges} />

      {/* اعلان «نسخهٔ جدید برنامه آماده است» (PWA — رویداد onNeedRefresh) */}
      <UpdateToast />
    </div>
  );
}
