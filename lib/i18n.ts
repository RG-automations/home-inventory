import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from '../locales/ar.json';
import de from '../locales/de.json';
import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import hi from '../locales/hi.json';
import pl from '../locales/pl.json';
import zh from '../locales/zh.json';

export const RTL_LANGUAGES = ['ar'];

export const SUPPORTED_LANGUAGES = [
  { code: 'pl', label: 'Polski' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'zh', label: '中文' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ar', label: 'العربية' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

const deviceLanguage = Localization.getLocales()[0]?.languageCode ?? 'en';
const initialLanguage = SUPPORTED_LANGUAGES.some((l) => l.code === deviceLanguage)
  ? deviceLanguage
  : 'en';

i18n.use(initReactI18next).init({
  resources: {
    pl: { translation: pl },
    en: { translation: en },
    de: { translation: de },
    es: { translation: es },
    fr: { translation: fr },
    zh: { translation: zh },
    hi: { translation: hi },
    ar: { translation: ar },
  },
  lng: initialLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
