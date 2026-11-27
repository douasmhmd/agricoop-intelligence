import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { cn } from '../src/lib/cn';
import {
  readThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  ThemeProvider,
  useTheme,
} from '../src/lib/theme';
import { inlineOffset, slideInFromEnd, slideInFromStart } from '../src/motion';

describe('motion presets', () => {
  it('mirror horizontal offsets in RTL', () => {
    expect(inlineOffset(24, 'ltr')).toBe(24);
    expect(inlineOffset(24, 'rtl')).toBe(-24);
    const hidden = slideInFromStart.hidden as (dir: 'ltr' | 'rtl') => { x: number };
    expect(hidden('ltr').x).toBeLessThan(0); // from the left in French
    expect(hidden('rtl').x).toBeGreaterThan(0); // from the right in Arabic
    const fromEnd = slideInFromEnd.hidden as (dir: 'ltr' | 'rtl') => { x: number };
    expect(fromEnd('rtl').x).toBeLessThan(0);
  });
});

describe('theme', () => {
  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('defaults to the system preference and ignores junk in storage', () => {
    expect(readThemePreference(undefined)).toBe('system');
    window.localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    expect(readThemePreference(window.localStorage)).toBe('system');
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(readThemePreference(window.localStorage)).toBe('dark');
  });

  it('resolves system to the OS setting', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('toggles .dark on <html> and remembers the choice', () => {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    let api: ReturnType<typeof useTheme> | undefined;
    function Probe() {
      api = useTheme();
      return <span>{api.resolved}</span>;
    }
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByText('light')).toBeTruthy();
    act(() => api!.setPreference('dark'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });
});

describe('cn', () => {
  it('keeps a display size and a text colour together', () => {
    expect(cn('text-display-lg', 'text-primary')).toBe('text-display-lg text-primary');
    expect(cn('text-sm', 'text-display-lg')).toBe('text-display-lg');
  });
});
