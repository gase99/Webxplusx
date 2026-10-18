import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useI18n } from './hooks/useI18n';
import { getSettings } from './storage/indexedDB';
import type { Project } from './types';
import Dashboard from './pages/Dashboard';
import About from './pages/About';

type Page = 'dashboard' | 'about';

function App() {
  const { t } = useTranslation();
  const { language, changeLanguage } = useI18n();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const settings = await getSettings();
      if (settings.language !== language) {
        await changeLanguage(settings.language);
      }
      setIsLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">{t('status.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              CabinetPro Web
            </h1>
            <span className="text-sm text-gray-500 dark:text-gray-400 hidden md:inline">
              {t('app.tagline')}
            </span>
          </div>

          <nav className="flex items-center gap-4">
            <button
              onClick={() => setCurrentPage('dashboard')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentPage === 'dashboard'
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {t('nav.dashboard')}
            </button>
            <button
              onClick={() => setCurrentPage('about')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentPage === 'about'
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {t('nav.about')}
            </button>

            {/* Language Switcher */}
            <button
              onClick={() => changeLanguage(language === 'fa' ? 'en' : 'fa')}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {language === 'fa' ? 'English' : 'فارسی'}
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {currentPage === 'dashboard' && (
          <Dashboard projects={projects} setProjects={setProjects} />
        )}
        {currentPage === 'about' && <About />}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>CabinetPro Web v1.0.0</p>
          <p className="mt-1">
            {t('about.developer')}: {t('about.developerName')}
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
