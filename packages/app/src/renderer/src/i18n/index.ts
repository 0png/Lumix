import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhTW from './locales/zh-TW.json';
import en from './locales/en.json';

export type Language = 'zh-TW' | 'en';

const STORAGE_KEY = 'lumix-language';

function getStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'zh-TW';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'zh-TW' || stored === 'en') {
    return stored;
  }
  return 'zh-TW';
}

export function setStoredLanguage(language: Language): void {
  localStorage.setItem(STORAGE_KEY, language);
}

i18n.use(initReactI18next).init({
  resources: {
    'zh-TW': { translation: zhTW },
    en: { translation: en },
  },
  lng: getStoredLanguage(),
  fallbackLng: 'zh-TW',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
