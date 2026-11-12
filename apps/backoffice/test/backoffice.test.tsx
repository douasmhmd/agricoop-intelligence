import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch, setCoopHeaderProvider } from '@/api/fetcher';
import { ok } from '@/api/ok';
import { safeReturnPath } from '@/auth/return-path';
import { ErrorAlert } from '@/components/common';
import { setLanguage } from '@/i18n';
import ar from '@/i18n/locales/ar.json';
import fr from '@/i18n/locales/fr.json';
import { PreferencesProvider, usePreferences } from '@/state/preferences';

const srcDir = join(__dirname, '..', 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory())
      return name === 'generated' || name === 'ui' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) && !name.endsWith('.gen.ts') ? [path] : [];
  });
}

function has(dict: unknown, key: string): boolean {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return false;
    const obj = node as Record<string, unknown>;
    node = part in obj ? obj[part] : (obj[`${part}_one`] ?? obj[`${part}_other`]);
    if (node === undefined) return false;
  }
  return true;
}

describe('translations', () => {
  const used = new Set<string>();
  const prefixes = new Set<string>();
  for (const file of sourceFiles(srcDir)) {
    const code = readFileSync(file, 'utf8');
    for (const m of code.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) used.add(m[1]!);
    for (const m of code.matchAll(/\bt\(\s*`([a-zA-Z0-9_.]+)\.\$\{/g)) prefixes.add(m[1]!);
  }

  it('finds the keys used by the app', () => {
    expect(used.size).toBeGreaterThan(100);
  });

  it.each([
    ['fr', fr],
    ['ar', ar],
  ])('%s defines every key used in the code', (_lang, dict) => {
    expect([...used].filter((k) => !has(dict, k))).toEqual([]);
    expect([...prefixes].filter((p) => !has(dict, p))).toEqual([]);
  });
});

describe('ErrorAlert', () => {
  afterEach(async () => {
    await setLanguage('fr');
  });

  it('translates API problems by their stable code, in French and Arabic', async () => {
    const error = new ApiError(409, {
      type: 'urn:agricoop:problem:stock_insuffisant',
      title: 'Insufficient stock',
      status: 409,
      code: 'stock_insuffisant',
    });
    const { rerender } = render(<ErrorAlert error={error} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Stock insuffisant.');
    await act(() => setLanguage('ar'));
    rerender(<ErrorAlert error={error} />);
    expect(screen.getByRole('alert')).toHaveTextContent('المخزون غير كافٍ.');
  });
});

describe('preferences', () => {
  it('shows synthetic data by default and remembers the choice', () => {
    window.localStorage.clear();
    const { result } = renderHook(() => usePreferences(), { wrapper: PreferencesProvider });
    expect(result.current.synthetic).toBe('include');
    act(() => result.current.setShowSynthetic(false));
    expect(result.current.synthetic).toBe('exclude');
    expect(window.localStorage.getItem('agricoop.backoffice.showSynthetic')).toBe('false');
  });
});

describe('X-Coop-Id', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setCoopHeaderProvider(() => undefined);
  });

  it('is sent only when a saas_admin has chosen a cooperative', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const header = () =>
      new Headers((fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit])[1].headers).get(
        'x-coop-id',
      );
    await apiFetch('/api/v1/produits');
    expect(header()).toBeNull();
    setCoopHeaderProvider(() => '11111111-1111-4111-8111-111111111111');
    await apiFetch('/api/v1/produits');
    expect(header()).toBe('11111111-1111-4111-8111-111111111111');
  });
});

describe('ok()', () => {
  it('returns the data of 2xx envelopes only', () => {
    expect(ok({ status: 200, data: [1] })).toEqual([1]);
    expect(ok({ status: 404, data: { title: 'x' } })).toBeUndefined();
    expect(ok(undefined)).toBeUndefined();
  });
});

describe('safeReturnPath', () => {
  it('keeps same-origin paths and rejects anything that could leave the app', () => {
    expect(safeReturnPath('/lots/abc?x=1')).toBe('/lots/abc?x=1');
    for (const bad of [
      '//evil.example',
      '/\\evil.example',
      'https://evil.example',
      undefined,
      42,
    ]) {
      expect(safeReturnPath(bad)).toBe('/');
    }
  });
});
