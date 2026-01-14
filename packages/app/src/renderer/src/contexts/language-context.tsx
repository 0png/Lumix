import { createContext, useContext, useCallback, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { type Language, setStoredLanguage } from '@/i18n';

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const { i18n, t } = useTranslation();
  const language = i18n.language as Language;

  const setLanguage = useCallback(
    (newLanguage: Language) => {
      setStoredLanguage(newLanguage);
      i18n.changeLanguage(newLanguage);
    },
    [i18n]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
