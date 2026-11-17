import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it } from 'vitest';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import i18n, { setLanguage } from '@/i18n';

describe('i18n', () => {
  afterEach(async () => {
    await setLanguage('fr');
  });

  it('defaults to French, left-to-right', () => {
    expect(i18n.language).toBe('fr');
    expect(document.documentElement.lang).toBe('fr');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('switches the whole document to right-to-left for Arabic', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <LanguageSwitcher />
      </I18nextProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: /العربية/ }));
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(screen.getByRole('group', { name: 'اللغة' })).toBeInTheDocument();
  });

  it('has the same keys in French and Arabic', async () => {
    const fr = (await import('@/i18n/locales/fr.json')).default;
    const ar = (await import('@/i18n/locales/ar.json')).default;
    const keys = (o: object, p = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === 'object' && v !== null ? keys(v as object, `${p}${k}.`) : [`${p}${k}`],
      );
    // Arabic has more plural forms (zero/one/two/few/many/other): compare base keys.
    const base = (list: string[]) =>
      [...new Set(list.map((k) => k.replace(/_(zero|one|two|few|many|other)$/, '')))].sort();
    expect(base(keys(ar))).toEqual(base(keys(fr)));
  });
});
