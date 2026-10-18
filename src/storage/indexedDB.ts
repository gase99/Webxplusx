import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Project, Settings, Language } from '../types';

interface CabinetProDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { 'by-updated': Date };
  };
  settings: {
    key: string;
    value: Settings;
  };
}

const DB_NAME = 'cabinetpro-db';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<CabinetProDB> | null = null;

async function getDB(): Promise<IDBPDatabase<CabinetProDB>> {
  if (dbInstance) return dbInstance;
  
  dbInstance = await openDB<CabinetProDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
      projectStore.createIndex('by-updated', 'updatedAt');
      
      db.createObjectStore('settings', { keyPath: 'language' });
    },
  });

  return dbInstance;
}

// Project operations
export async function getAllProjects(): Promise<Project[]> {
  const db = await getDB();
  const projects = await db.getAll('projects');
  return projects.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await getDB();
  return db.get('projects', id);
}

export async function saveProject(project: Project): Promise<void> {
  const db = await getDB();
  project.updatedAt = new Date();
  await db.put('projects', project);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('projects', id);
}

export async function duplicateProject(id: string): Promise<Project | null> {
  const db = await getDB();
  const project = await db.get('projects', id);
  if (!project) return null;

  const duplicate: Project = {
    ...project,
    id: crypto.randomUUID(),
    name: `${project.name} (copy)`,
    nameFa: `${project.nameFa} (کپی)`,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.put('projects', duplicate);
  return duplicate;
}

// Settings operations
export async function getSettings(): Promise<Settings> {
  const db = await getDB();
  const settings = await db.get('settings', 'fa');
  if (!settings) {
    const defaultSettings: Settings = {
      language: 'fa',
      theme: 'light',
      defaultMaterial: 'mdf-16mm',
      sawKerf: 0.4,
      sheetMargin: 0,
    };
    await db.put('settings', defaultSettings);
    return defaultSettings;
  }
  return settings;
}

export async function saveSettings(settings: Settings): Promise<void> {
  const db = await getDB();
  await db.put('settings', settings);
}

export async function updateLanguage(language: Language): Promise<void> {
  const settings = await getSettings();
  settings.language = language;
  await saveSettings(settings);
  
  // Update HTML direction
  document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr';
  document.documentElement.lang = language;
}

// Export/Import
export async function exportProject(id: string): Promise<string> {
  const project = await getProject(id);
  if (!project) throw new Error('Project not found');
  return JSON.stringify(project, null, 2);
}

export async function importProject(json: string): Promise<Project> {
  const project = JSON.parse(json) as Project;
  project.id = crypto.randomUUID();
  project.updatedAt = new Date();
  await saveProject(project);
  return project;
}
