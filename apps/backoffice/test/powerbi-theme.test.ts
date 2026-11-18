// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildThemes, oklchToHex, OUTPUT, serialize } from '../scripts/powerbi-theme';

describe('Power BI report themes', () => {
  it('converts OKLCH tokens to sRGB hex', () => {
    expect(oklchToHex('oklch(1 0 0)')).toBe('#ffffff');
    expect(oklchToHex('oklch(0 0 0)')).toBe('#000000');
    expect(oklchToHex('oklch(0.6279 0.2577 29.23)')).toBe('#ff0000');
  });

  it('match the design tokens (run scripts/powerbi-theme.ts after a colour change)', () => {
    const themes = buildThemes();
    for (const file of OUTPUT.light)
      expect(readFileSync(file, 'utf8'), file).toBe(serialize(themes.light));
    for (const file of OUTPUT.dark)
      expect(readFileSync(file, 'utf8'), file).toBe(serialize(themes.dark));
    expect(themes.light.background).not.toBe(themes.dark.background);
  });
});
