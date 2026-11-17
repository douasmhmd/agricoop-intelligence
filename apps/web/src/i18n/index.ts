import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { z } from 'zod';
import ar from './locales/ar.json';
import fr from './locales/fr.json';

export const LANGUAGES = ['fr', 'ar'] as const;
export type Language = (typeof LANGUAGES)[number];

const STORAGE_KEY = 'agricoop.lang';

function storedLanguage(): Language | undefined {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return LANGUAGES.find((l) => l === value);
  } catch {
    return undefined;
  }
}

/** Mirrors the active language on <html lang dir> so the whole layout flips for Arabic (RTL). */
function applyDocumentDirection(lng: string): void {
  // No document during the build-time pre-render (src/prerender/entry.tsx).
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lng;
  document.documentElement.dir = i18n.dir(lng);
  // Zod's built-in validation messages follow the UI language (custom messages stay as written).
  z.config(lng === 'ar' ? z.locales.ar() : z.locales.fr());
}

export function setLanguage(lng: Language): Promise<unknown> {
  try {
    window.localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // Storage unavailable (private mode): the choice simply is not remembered.
  }
  return i18n.changeLanguage(lng);
}

i18n.on('languageChanged', applyDocumentDirection);

void i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, ar: { translation: ar } },
  lng: storedLanguage() ?? 'fr',
  fallbackLng: 'fr',
  supportedLngs: [...LANGUAGES],
  interpolation: { escapeValue: false },
});

applyDocumentDirection(i18n.language);

export default i18n;
