import { useState, useEffect } from 'react';
import i18n from '../i18n/config';
import { updateLanguage } from '../storage/indexedDB';
import type { Language } from '../types';

export function useI18n() {
  const [language, setLanguageState] = useState<Language>(
    (i18n.language as Language) || 'fa'
  );

  useEffect(() => {
    // Set initial direction
    document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const changeLanguage = async (lang: Language) => {
    await i18n.changeLanguage(lang);
    setLanguageState(lang);
    await updateLanguage(lang);
  };

  return {
    language,
    changeLanguage,
    t: i18n.t.bind(i18n),
    i18n,
  };
}
