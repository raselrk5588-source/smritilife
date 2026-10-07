import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'বাংলা' | 'English';
type Theme = 'Light mode' | 'Dark mode';

interface SettingsContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  t: (bn: string, en: string) => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('বাংলা');
  const [theme, setTheme] = useState<Theme>('Light mode');

  useEffect(() => {
    if (theme === 'Dark mode') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const t = (bn: string, en: string) => language === 'বাংলা' ? bn : en;

  return (
    <SettingsContext.Provider value={{ language, setLanguage, theme, setTheme, t }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
};
