import type { Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:5173';
export const BACKOFFICE_URL = process.env.E2E_BACKOFFICE_URL ?? 'http://localhost:5174';
export const STORAGE_STATE = fileURLToPath(new URL('../.auth/backoffice.json', import.meta.url));

export const PHASE = process.env.VISUAL_PHASE ?? 'phase1';
export const OUT_DIR = fileURLToPath(new URL(`../screenshots/redesign/${PHASE}/`, import.meta.url));

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
} as const;

export const THEMES = ['light', 'dark'] as const;
export const LANGS = ['fr', 'ar'] as const;

export type Variant = {
  viewport: keyof typeof VIEWPORTS;
  theme: (typeof THEMES)[number];
  lang: (typeof LANGS)[number];
};

export const VARIANTS: Variant[] = Object.keys(VIEWPORTS).flatMap((viewport) =>
  THEMES.flatMap((theme) =>
    LANGS.map((lang) => ({ viewport: viewport as Variant['viewport'], theme, lang })),
  ),
);

/** Same storage keys as the apps (i18n and @agricoop/ui ThemeProvider), set before any script runs. */
export async function applyVariant(page: Page, v: Variant): Promise<void> {
  await page.setViewportSize(VIEWPORTS[v.viewport]);
  await page.addInitScript(
    ([lang, theme]) => {
      window.localStorage.setItem('agricoop.lang', lang);
      window.localStorage.setItem('agricoop.theme', theme);
    },
    [v.lang, v.theme] as const,
  );
}

/**
 * Scroll reveals play once when a section enters the viewport: walk the page top to bottom so a
 * full-page screenshot shows every section, then wait for fonts and animations to settle.
 */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const step = Math.round(window.innerHeight * 0.6);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(900);
}

export function shotName(page: string, v: Variant): string {
  return `${OUT_DIR}${page}-${v.viewport}-${v.theme}-${v.lang}.png`;
}
