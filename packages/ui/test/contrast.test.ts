// @vitest-environment node
/*
 * WCAG AA for the semantic token pairs, in both themes, computed from theme.css itself (OKLCH →
 * sRGB → relative luminance). Changing a colour that breaks AA fails this test.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  fileURLToPath(new URL('../src/styles/theme.css', import.meta.url)),
  'utf8',
);

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`\n${selector} {`);
  const body = css.slice(start, css.indexOf('\n}', start));
  const vars: Record<string, string> = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(oklch\([^)]*\))/g)) vars[m[1]!] = m[2]!;
  return vars;
}

/** oklch(L C H [/ a]) → linear sRGB (gamut-clipped). */
function toLinearRgb(value: string): [number, number, number] {
  const [l, c, h] = value
    .replace(/oklch\(|\)/g, '')
    .split('/')[0]!
    .trim()
    .split(/\s+/)
    .map(Number) as [number, number, number];
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clip = (v: number) => Math.min(1, Math.max(0, v));
  return [
    clip(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    clip(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    clip(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ];
}

function luminance(value: string): number {
  const [r, g, b] = toLinearRgb(value);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(fg: string, bg: string): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** [text token, background token, minimum ratio] */
const PAIRS: [string, string, number][] = [
  ['foreground', 'background', 7],
  ['foreground', 'card', 7],
  ['muted-foreground', 'background', 4.5],
  ['muted-foreground', 'card', 4.5],
  ['muted-foreground', 'muted', 4.5],
  ['primary-foreground', 'primary', 4.5],
  ['secondary-foreground', 'secondary', 4.5],
  ['accent-foreground', 'accent', 4.5],
  ['gold-foreground', 'gold', 4.5],
  ['terracotta-foreground', 'terracotta', 4.5],
  ['destructive-foreground', 'destructive', 4.5],
  ['success-foreground', 'success', 4.5],
  ['warning-foreground', 'warning', 4.5],
  ['info-foreground', 'info', 4.5],
  // Coloured text on the page (links, badges on a faint tint, inline errors).
  ['primary', 'background', 4.5],
  ['destructive', 'background', 4.5],
  ['success', 'background', 4.5],
  ['info', 'background', 4.5],
  ['terracotta', 'background', 4.5],
  // Focus ring and input borders: non-text UI, 3:1 (WCAG 1.4.11).
  ['ring', 'background', 3],
];

describe.each([
  ['light', ':root'],
  ['dark', '.dark'],
])('%s theme contrast (WCAG AA)', (_name, selector) => {
  const vars = block(selector);
  it.each(PAIRS)('%s on %s ≥ %d:1', (fg, bg, min) => {
    expect(vars[fg], `--${fg}`).toBeDefined();
    expect(vars[bg], `--${bg}`).toBeDefined();
    expect(contrast(vars[fg]!, vars[bg]!)).toBeGreaterThanOrEqual(min);
  });
});
