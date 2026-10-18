import { useEffect, useMemo, useRef, useState } from 'react';
import { isValidPart } from '../types/part';
import type { Project } from '../types/project';
import {
  ChevronDownIcon,
  FilePlusIcon,
  FolderOpenIcon,
  SaveIcon,
  SearchIcon,
  TrashIcon,
  XIcon,
} from './icons';

/**
 * A-Cut 2Dpro — مدیریت پروژه‌ها (فاز ۵)
 * =====================================
 * دکمهٔ Dropdown در هدر + مودال فهرست پروژه‌های ذخیره‌شده.
 * خود کامپوننت فقط نمایش و رویدادهاست؛ منطق ذخیره/بازکردن/حذف و
 * هشدار تغییرات ذخیره‌نشده در App (مالک Stateها) انجام می‌شود.
 */

const faNumber = new Intl.NumberFormat('fa-IR');
const faDateTime = new Intl.DateTimeFormat('fa-IR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

interface ProjectManagerProps {
  projects: Project[];
  currentProjectId: string | null;
  currentProjectName: string;
  isDirty: boolean;
  onSave: () => void;
  onSaveAs: () => void;
  onNew: () => void;
  onOpen: (project: Project) => void;
  onDelete: (project: Project) => void;
}

function projectStats(project: Project): { rows: number; totalQty: number } {
  const valid = project.parts.filter(isValidPart);
  return { rows: valid.length, totalQty: valid.reduce((sum, p) => sum + p.qty, 0) };
}

export default function ProjectManager({
  projects,
  currentProjectId,
  currentProjectName,
  isDirty,
  onSave,
  onSaveAs,
  onNew,
  onOpen,
  onDelete,
}: ProjectManagerProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => b.updatedAt - a.updatedAt),
    [projects],
  );
  const recentProjects = sortedProjects.slice(0, 5);

  // بستن منو با کلیک بیرون یا Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const runAndClose = (fn: () => void) => () => {
    setMenuOpen(false);
    fn();
  };

  const menuItemClass =
    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-[13px] font-semibold text-slate-700 transition hover:bg-slate-100';

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-3.5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-sky-500 active:scale-[0.98]"
        >
          <FolderOpenIcon />
          مدیریت پروژه‌ها
          {isDirty && (
            <span
              className="h-2 w-2 rounded-full bg-amber-300 ring-2 ring-amber-300/30"
              title="تغییرات ذخیره‌نشده دارید"
            />
          )}
          <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute end-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-2xl bg-white p-2 text-slate-800 shadow-xl ring-1 ring-slate-900/10"
          >
            {/* پروژهٔ جاری */}
            <div className="rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200">
              <p className="text-[11px] font-semibold text-slate-400">پروژهٔ جاری</p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm font-extrabold">
                <span className="truncate">{currentProjectName}</span>
                {isDirty ? (
                  <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                    ذخیره نشده
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                    ذخیره‌شده ✓
                  </span>
                )}
              </p>
            </div>

            <div className="mt-1.5 space-y-0.5">
              <button type="button" className={menuItemClass} onClick={runAndClose(onSave)}>
                <SaveIcon className="text-sky-700" />
                ذخیرهٔ پروژه
                <span className="ms-auto text-[10px] font-medium text-slate-400" dir="ltr">Save</span>
              </button>
              <button type="button" className={menuItemClass} onClick={runAndClose(onSaveAs)}>
                <SaveIcon className="text-slate-400" />
                ذخیره با نام جدید…
                <span className="ms-auto text-[10px] font-medium text-slate-400" dir="ltr">Save As</span>
              </button>
              <button type="button" className={menuItemClass} onClick={runAndClose(onNew)}>
                <FilePlusIcon className="text-emerald-600" />
                پروژهٔ جدید
              </button>
              <button
                type="button"
                className={menuItemClass}
                onClick={runAndClose(() => setListOpen(true))}
              >
                <FolderOpenIcon className="text-amber-600" />
                باز کردن پروژه…
                <span className="ms-auto rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-500">
                  {faNumber.format(projects.length)}
                </span>
              </button>
            </div>

            {recentProjects.length > 0 && (
              <>
                <div className="mx-2 my-2 border-t border-slate-100" />
                <p className="px-3 pb-1 text-[11px] font-semibold text-slate-400">اخیراً استفاده‌شده</p>
                <ul className="space-y-0.5">
                  {recentProjects.map((project) => (
                    <li key={project.id}>
                      <button
                        type="button"
                        disabled={project.id === currentProjectId}
                        onClick={runAndClose(() => onOpen(project))}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-right text-[13px] text-slate-600 transition hover:bg-slate-100 disabled:cursor-default disabled:opacity-50"
                      >
                        <span className="truncate font-semibold">{project.name}</span>
                        {project.id === currentProjectId && (
                          <span className="shrink-0 text-[10px] font-bold text-sky-700">فعلی</span>
                        )}
                        <span className="ms-auto shrink-0 text-[10px] tabular-nums text-slate-400">
                          {faNumber.format(projectStats(project).totalQty)} قطعه
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>

      {listOpen && (
        <ProjectListModal
          projects={sortedProjects}
          currentProjectId={currentProjectId}
          onClose={() => setListOpen(false)}
          onOpen={(project) => {
            setListOpen(false);
            onOpen(project);
          }}
          onDelete={onDelete}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  مودال فهرست پروژه‌های ذخیره‌شده                                     */
/* ------------------------------------------------------------------ */

interface ProjectListModalProps {
  projects: Project[];
  currentProjectId: string | null;
  onClose: () => void;
  onOpen: (project: Project) => void;
  onDelete: (project: Project) => void;
}

function ProjectListModal({ projects, currentProjectId, onClose, onOpen, onDelete }: ProjectListModalProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim();
    return q ? projects.filter((p) => p.name.includes(q)) : projects;
  }, [projects, query]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="پروژه‌های ذخیره‌شده"
        className="mt-[6vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white text-slate-800 shadow-2xl ring-1 ring-slate-900/10"
      >
        <header className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 text-sky-800">
            <FolderOpenIcon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-black">پروژه‌های ذخیره‌شده</h2>
            <p className="text-[11px] text-slate-500">
              {faNumber.format(projects.length)} پروژه روی همین دستگاه (localStorage)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="ms-auto rounded-lg p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
          >
            <XIcon />
          </button>
        </header>

        <div className="border-b border-slate-100 px-5 py-3">
          <label className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 ring-1 ring-transparent transition focus-within:bg-white focus-within:ring-sky-300">
            <SearchIcon className="shrink-0 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجو در نام پروژه…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              autoFocus
            />
          </label>
        </div>

        <div className="max-h-[56vh] overflow-y-auto px-3 py-3">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-3xl">📂</p>
              <p className="mt-2 text-sm font-bold text-slate-600">
                {projects.length === 0 ? 'هنوز پروژه‌ای ذخیره نشده است' : 'پروژه‌ای با این نام پیدا نشد'}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {projects.length === 0
                  ? 'از منوی «مدیریت پروژه‌ها» گزینهٔ «ذخیرهٔ پروژه» را بزنید تا اینجا دیده شود.'
                  : 'عبارت جستجو را تغییر دهید.'}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((project) => {
                const stats = projectStats(project);
                const isCurrent = project.id === currentProjectId;
                return (
                  <li
                    key={project.id}
                    className={`flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 ring-1 transition ${
                      isCurrent ? 'bg-sky-50 ring-sky-300' : 'bg-white ring-slate-200 hover:ring-slate-300'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-extrabold">{project.name}</span>
                        {isCurrent && (
                          <span className="rounded-full bg-sky-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            پروژهٔ فعلی
                          </span>
                        )}
                        {project.lastLayout && (
                          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 ring-1 ring-emerald-200">
                            دارای نقشهٔ برش ✓
                          </span>
                        )}
                      </p>
                      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                        <span>آخرین ویرایش: {faDateTime.format(project.updatedAt)}</span>
                        <span>
                          {faNumber.format(stats.rows)} ردیف · مجموع {faNumber.format(stats.totalQty)} قطعه
                        </span>
                        <span dir="ltr" className="tabular-nums">
                          {project.settings.stockLength} × {project.settings.stockWidth} mm
                        </span>
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isCurrent}
                        onClick={() => onOpen(project)}
                        className="rounded-lg bg-sky-700 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-sky-600 disabled:cursor-default disabled:bg-slate-300"
                      >
                        {isCurrent ? 'باز است' : 'باز کردن'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(project)}
                        title={`حذف پروژهٔ «${project.name}»`}
                        aria-label={`حذف پروژهٔ ${project.name}`}
                        className="rounded-lg p-2 text-slate-400 ring-1 ring-slate-200 transition hover:bg-rose-50 hover:text-rose-700 hover:ring-rose-200"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-[11px] text-slate-400">
          پروژه‌ها فقط روی همین مرورگر/دستگاه ذخیره می‌شوند. باز کردن یک پروژه، قطعات و تنظیمات
          فعلی را جایگزین می‌کند (در صورت تغییرات ذخیره‌نشده ابتدا هشدار داده می‌شود).
        </footer>
      </div>
    </div>
  );
}
