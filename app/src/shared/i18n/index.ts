import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import ca from './locales/ca.json';
import en from './locales/en.json';
import es from './locales/es.json';

export const SUPPORTED_LANGUAGES = ['ca', 'es', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const FALLBACK_LANGUAGE: Language = 'en';

export const resources = {
  ca: { translation: ca },
  es: { translation: es },
  en: { translation: en },
} as const;

/** First device language we support, in the user's order of preference. */
export function detectLanguage(deviceLanguages: (string | null)[]): Language {
  const match = deviceLanguages.find((code): code is Language =>
    SUPPORTED_LANGUAGES.includes(code as Language),
  );
  return match ?? FALLBACK_LANGUAGE;
}

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(getLocales().map((l) => l.languageCode)),
  fallbackLng: FALLBACK_LANGUAGE,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export { i18n };
export { useTranslation } from 'react-i18next';
