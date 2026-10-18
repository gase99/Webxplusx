import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { calculateBaseCabinet, calculateWallCabinet, calculateDrawer } from '../engine/cabinet';
import type { Project, Cabinet } from '../types';

interface CabinetEditorProps {
  project: Project;
  onAddCabinet: (cabinet: Cabinet) => void;
  onClose: () => void;
}

function CabinetEditor({ onAddCabinet, onClose }: CabinetEditorProps) {
  const { t } = useTranslation();
  const [cabinetType, setCabinetType] = useState<'base' | 'wall' | 'drawer'>('base');
  const [name, setName] = useState('');
  const [width, setWidth] = useState(80);
  const [depth, setDepth] = useState(58);
  const [height, setHeight] = useState(73.4);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const id = crypto.randomUUID();
    let cabinet: Cabinet;

    if (cabinetType === 'base') {
      cabinet = calculateBaseCabinet(id, name, width, depth, height);
    } else if (cabinetType === 'wall') {
      cabinet = calculateWallCabinet(id, name, width, depth, height);
    } else {
      cabinet = calculateDrawer(id, name, depth, width, height, 1);
    }

    onAddCabinet(cabinet);
    onClose();
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
        >
          ← Back
        </button>
        <h2 className="text-2xl font-bold">{t('actions.create')} {t('nav.cabinets')}</h2>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-6">
        {/* Cabinet Type */}
        <div>
          <label className="block text-sm font-medium mb-2">{t('nav.cabinets')} Type</label>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setCabinetType('base')}
              className={`p-4 rounded-lg border-2 transition-colors ${
                cabinetType === 'base'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="text-center">
                <div className="text-2xl mb-1">🗄️</div>
                <div className="text-sm font-medium">{t('cabinet.base')}</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setCabinetType('wall')}
              className={`p-4 rounded-lg border-2 transition-colors ${
                cabinetType === 'wall'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="text-center">
                <div className="text-2xl mb-1">📦</div>
                <div className="text-sm font-medium">{t('cabinet.wall')}</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setCabinetType('drawer')}
              className={`p-4 rounded-lg border-2 transition-colors ${
                cabinetType === 'drawer'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="text-center">
                <div className="text-2xl mb-1">🗃️</div>
                <div className="text-sm font-medium">{t('cabinet.drawer')}</div>
              </div>
            </button>
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium mb-2">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
            placeholder="Cabinet name"
            required
          />
        </div>

        {/* Dimensions */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('dimensions.width')} ({t('dimensions.cm')})
            </label>
            <input
              type="number"
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              min="10"
              max="200"
              step="0.1"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('dimensions.depth')} ({t('dimensions.cm')})
            </label>
            <input
              type="number"
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              min="20"
              max="100"
              step="0.1"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('dimensions.height')} ({t('dimensions.cm')})
            </label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              min="20"
              max="250"
              step="0.1"
              required
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            {t('actions.create')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium"
          >
            {t('actions.cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CabinetEditor;
