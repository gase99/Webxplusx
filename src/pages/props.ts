/**
 * A-Cut 2Dpro — قرارداد مشترک صفحه‌ها
 * ===================================
 * همهٔ صفحه‌ها یک شیء «کنترلر» می‌گیرند که App می‌سازد؛ به این ترتیب:
 *  - وضعیت (قطعات، تنظیمات، نتیجه، انتخاب الگوریتم) بین صفحه‌ها حفظ می‌شود
 *  - هیچ صفحه‌ای نسخهٔ دوم منطق محاسبه/ذخیره‌سازی ندارد
 *  - جابه‌جایی بین زبانه‌ها دادهٔ کاربر را از بین نمی‌برد
 */
import type { AlgorithmSelection, LayoutResult, PackingProgress } from '../algorithm';
import type { AppTheme } from '../components/ThemeToggle';
import type { AppTab } from '../components/BottomNav';
import type { DbError } from '../db/database';
import type { PackingSettings } from '../storage/packingSettings';
import type { CutPart } from '../types/part';
import type { LayoutSettings, LayoutState, Project } from '../types/project';
import type { PartsStats } from '../lib/stats';

export interface EngineView {
  result: LayoutResult | null;
  resultParts: CutPart[];
  isStale: boolean;
  busy: boolean;
  progress: PackingProgress | null;
  error: string | null;
  warnings: string[];
  canCalculate: boolean;
  calculate: () => void;
  cancel: () => void;
}

export interface AppController {
  /* ناوبری */
  tab: AppTab;
  setTab: (tab: AppTab) => void;

  /* دادهٔ کاری */
  rows: CutPart[];
  setRows: React.Dispatch<React.SetStateAction<CutPart[]>>;
  activeId: string | null;
  setActiveId: (id: string) => void;
  settings: LayoutSettings;
  setSettings: (settings: LayoutSettings) => void;
  layoutState: LayoutState | null;
  setLayoutState: (state: LayoutState | null) => void;
  engine: EngineView;
  stats: PartsStats;

  /* پروژه */
  currentProjectName: string;
  setCurrentProjectName: (name: string) => void;
  currentProjectId: string | null;
  isDirty: boolean;
  saveNotice: string | null;
  projects: Project[];
  dbReady: boolean;
  dbError: DbError | null;
  clearDbError: () => void;
  saveProject: (saveAs?: boolean) => void;
  newProject: () => void;
  openProject: (project: Project) => void;
  deleteProject: (project: Project) => void;

  /* تنظیمات موتور/الگوریتم */
  packing: PackingSettings;
  setSelection: (selection: AlgorithmSelection) => void;
  setMaxSheets: (value: number) => void;
  setAutoRecalculate: (value: boolean) => void;

  /* ظاهر و سیستم */
  theme: AppTheme;
  toggleTheme: () => void;
}

export interface PageProps {
  app: AppController;
}
