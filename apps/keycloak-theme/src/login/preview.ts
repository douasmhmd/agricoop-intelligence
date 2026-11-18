/*
 * Dev-only preview of the theme's pages without Keycloak (Keycloakify mock contexts):
 *   /?page=login.ftl&lang=fr|ar|en&state=error|info
 * Used by `pnpm dev` and by the screenshot script (apps/e2e/visual/login-preview.visual.ts).
 */
import { createGetKcContextMock } from 'keycloakify/login/KcContext';
import { kcEnvDefaults } from '../kc.gen';
import type { KcContext, KcContextExtension } from './KcContext';

const kcContextExtension: KcContextExtension = {
  themeName: 'agricoop',
  properties: { ...kcEnvDefaults },
};

const { getKcContextMock } = createGetKcContextMock({
  kcContextExtension,
  kcContextExtensionPerPage: {},
  overrides: {},
  overridesPerPage: {},
});

const LANGUAGES = [
  { languageTag: 'fr', label: 'Français' },
  { languageTag: 'ar', label: 'العربية' },
  { languageTag: 'en', label: 'English' },
];

/** What Keycloak would send after a failed attempt, per language. */
const INVALID: Record<string, string> = {
  fr: 'Identifiant ou mot de passe incorrect.',
  ar: 'اسم المستخدم أو كلمة المرور غير صحيحة.',
  en: 'Invalid username or password.',
};

export function previewKcContext(params: URLSearchParams): KcContext {
  const pageId = (params.get('page') ?? 'login.ftl') as KcContext['pageId'];
  const lang = params.get('lang') ?? 'fr';
  const state = params.get('state');
  const href = (tag: string) => {
    const next = new URLSearchParams(params);
    next.set('lang', tag);
    return `?${next.toString()}`;
  };
  const failed = state === 'error';

  return getKcContextMock({
    pageId: pageId as 'login.ftl',
    overrides: {
      locale: {
        currentLanguageTag: lang,
        rtl: lang === 'ar',
        supported: LANGUAGES.map((l) => ({ ...l, url: href(l.languageTag) })),
      },
      realm: {
        displayName: 'AgriCoop',
        internationalizationEnabled: true,
        registrationAllowed: true,
        resetPasswordAllowed: true,
        rememberMe: true,
        loginWithEmailAllowed: true,
      },
      ...(failed
        ? {
            login: { username: 'manager.coop01' },
            messagesPerField: {
              existsError: (...fields: string[]) =>
                fields.includes('username') || fields.includes('password'),
              getFirstError: () => INVALID[lang] ?? INVALID.en!,
              exists: () => true,
              get: () => INVALID[lang] ?? INVALID.en!,
              printIfExists: <T>(_field: string, text: T) => text,
            },
          }
        : {}),
      ...(state === 'info'
        ? {
            message: {
              type: 'info' as const,
              summary: 'Votre session a expiré. Reconnectez-vous.',
            },
          }
        : {}),
    },
  });
}
