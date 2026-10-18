import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getAllProjects, saveProject, deleteProject, duplicateProject } from '../storage/indexedDB';
import type { Project, Cabinet } from '../types';
import CabinetEditor from '../components/CabinetEditor';

interface DashboardProps {
  projects: Project[];
  setProjects: (projects: Project[]) => void;
}

function Dashboard({ projects, setProjects }: DashboardProps) {
  const { t } = useTranslation();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCabinetEditor, setShowCabinetEditor] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    const loaded = await getAllProjects();
    setProjects(loaded);
  };

  const handleCreateProject = async (name: string, nameFa: string) => {
    const project: Project = {
      id: crypto.randomUUID(),
      name,
      nameFa,
      createdAt: new Date(),
      updatedAt: new Date(),
      cabinets: [],
    };
    await saveProject(project);
    await loadProjects();
    setShowCreateDialog(false);
  };

  const handleDeleteProject = async (id: string) => {
    if (confirm(t('actions.delete') + '?')) {
      await deleteProject(id);
      await loadProjects();
      if (selectedProject?.id === id) {
        setSelectedProject(null);
      }
    }
  };

  const handleDuplicateProject = async (id: string) => {
    await duplicateProject(id);
    await loadProjects();
  };

  const handleAddCabinet = (cabinet: Cabinet) => {
    if (selectedProject) {
      selectedProject.cabinets.push(cabinet);
      selectedProject.updatedAt = new Date();
      saveProject(selectedProject);
      loadProjects();
    }
  };

  if (showCabinetEditor && selectedProject) {
    return (
      <CabinetEditor
        project={selectedProject}
        onAddCabinet={handleAddCabinet}
        onClose={() => setShowCabinetEditor(false)}
      />
    );
  }

  if (selectedProject) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedProject(null)}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            ← {t('nav.dashboard')}
          </button>
          <button
            onClick={() => setShowCabinetEditor(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('actions.create')} {t('cabinet.base')}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-4">{selectedProject.name}</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{selectedProject.nameFa}</p>
          
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">{t('nav.cabinets')}</h3>
            {selectedProject.cabinets.length === 0 ? (
              <p className="text-gray-500">No cabinets yet. Click the button above to add one.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedProject.cabinets.map((cabinet) => (
                  <div
                    key={cabinet.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div className="font-semibold">{cabinet.name}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      {t(`cabinet.${cabinet.type}`)}
                    </div>
                    {cabinet.type !== 'drawer' && (
                      <div className="text-sm mt-2">
                        {cabinet.width} × {cabinet.depth} × {cabinet.height} cm
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('nav.projects')}</h2>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {t('actions.create')} {t('nav.projects')}
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-lg mb-4">
            No projects yet
          </p>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('actions.create')} {t('nav.projects')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6"
            >
              <h3 className="text-lg font-semibold mb-2">{project.name}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {project.nameFa}
              </p>
              <div className="text-sm text-gray-500 mb-4">
                {project.cabinets.length} {t('nav.cabinets')}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedProject(project)}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  {t('actions.edit')}
                </button>
                <button
                  onClick={() => handleDuplicateProject(project.id)}
                  className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-sm rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  {t('actions.duplicate')}
                </button>
                <button
                  onClick={() => handleDeleteProject(project.id)}
                  className="px-3 py-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 text-sm rounded hover:bg-red-200 dark:hover:bg-red-800"
                >
                  {t('actions.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Dialog */}
      {showCreateDialog && (
        <CreateProjectDialog
          onCreate={handleCreateProject}
          onClose={() => setShowCreateDialog(false)}
        />
      )}
    </div>
  );
}

interface CreateProjectDialogProps {
  onCreate: (name: string, nameFa: string) => void;
  onClose: () => void;
}

function CreateProjectDialog({ onCreate, onClose }: CreateProjectDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [nameFa, setNameFa] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && nameFa) {
      onCreate(name, nameFa);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
        <h3 className="text-xl font-bold mb-4">{t('actions.create')} {t('nav.projects')}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Project Name (English)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">نام پروژه (فارسی)</label>
            <input
              type="text"
              value={nameFa}
              onChange={(e) => setNameFa(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              dir="rtl"
              required
            />
          </div>
          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {t('actions.create')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              {t('actions.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Dashboard;
