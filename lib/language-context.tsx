import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { I18nManager, Platform } from 'react-native';
import i18n, { RTL_LANGUAGES, SUPPORTED_LANGUAGES, type LanguageCode } from './i18n';

const STORAGE_KEY = 'language-preference';

type LanguageContextValue = {
  language: LanguageCode;
  /** Returns true if a manual app restart is required for the change to fully apply (native RTL switch). */
  setLanguage: (language: LanguageCode) => boolean;
};

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: () => false,
});

/**
 * Ustawia kierunek tekstu (RTL dla arabskiego).
 * Zwraca true, jesli potrzebny jest reczny restart aplikacji.
 */
function applyRTLIfNeeded(next: LanguageCode): boolean {
  const shouldBeRTL = RTL_LANGUAGES.includes(next);

  if (Platform.OS === 'web') {
    // Na Web wystarczy atrybut dir na dokumencie — dziala od razu,
    // bez restartu (w przeciwienstwie do natywnego I18nManager).
    if (typeof document !== 'undefined') {
      document.documentElement.dir = shouldBeRTL ? 'rtl' : 'ltr';
      document.documentElement.lang = next;
    }
    return false;
  }

  if (I18nManager.isRTL === shouldBeRTL) {
    return false;
  }

  // Natywny uklad RTL przelacza sie dopiero po restarcie aplikacji —
  // ograniczenie React Native, nie da sie tego zrobic w locie.
  I18nManager.forceRTL(shouldBeRTL);
  return true;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(i18n.language as LanguageCode);

  useEffect(() => {
    // Kierunek tekstu dla jezyka wykrytego przy starcie (np. arabski z ustawien systemu).
    applyRTLIfNeeded(i18n.language as LanguageCode);

    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      const isSupported = SUPPORTED_LANGUAGES.some((l) => l.code === stored);
      if (stored && isSupported && stored !== i18n.language) {
        i18n.changeLanguage(stored);
        setLanguageState(stored as LanguageCode);
        applyRTLIfNeeded(stored as LanguageCode);
      }
    });
  }, []);

  function setLanguage(next: LanguageCode): boolean {
    i18n.changeLanguage(next);
    setLanguageState(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
    return applyRTLIfNeeded(next);
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
