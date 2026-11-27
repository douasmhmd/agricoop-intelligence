/*
 * Generates the Power BI report themes from the design tokens in packages/ui/src/styles/theme.css,
 * so the embedded report uses the brand palette:
 *   - src/analytics/powerbi/theme-{light,dark}.json: applied by the back office (report.applyTheme);
 *   - public/powerbi-theme{,-dark}.json: the same themes, downloadable for report authors
 *     (Power BI Desktop → View → Themes → Browse for themes).
 * Run after changing a colour:
 *
 *   node apps/backoffice/scripts/powerbi-theme.ts
 *
 * test/powerbi-theme.test.ts fails when the committed files drift from the tokens.
 * Power BI cannot load web fonts: Georgia stands in for the serif display face, Segoe UI for the
 * sans (both always available in Power BI).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const THEME_CSS = fileURLToPath(
  new URL('../../../packages/ui/src/styles/theme.css', import.meta.url),
);
export const OUTPUT = {
  light: [
    fileURLToPath(new URL('../src/analytics/powerbi/theme-light.json', import.meta.url)),
    fileURLToPath(new URL('../public/powerbi-theme.json', import.meta.url)),
  ],
  dark: [
    fileURLToPath(new URL('../src/analytics/powerbi/theme-dark.json', import.meta.url)),
    fileURLToPath(new URL('../public/powerbi-theme-dark.json', import.meta.url)),
  ],
};

/** CSS custom properties of one rule block (`:root` or `.dark`). */
function tokens(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`\n${selector} {`);
  if (start === -1) throw new Error(`${selector} not found in theme.css`);
  const body = css.slice(start, css.indexOf('\n}', start));
  const vars: Record<string, string> = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(oklch\([^)]*\))/g)) vars[m[1]!] = m[2]!;
  return vars;
}

/** oklch(L C H [/ a]) → #rrggbb (sRGB, gamut-clipped). */
export function oklchToHex(value: string): string {
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
  const linear = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  const channel = (v: number) => {
    const x = Math.min(1, Math.max(0, v));
    const srgb = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
    return Math.round(srgb * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${linear.map(channel).join('')}`;
}

const SANS = "'Segoe UI', wf_segoe-ui_normal, helvetica, arial, sans-serif";
const SERIF = 'Georgia, serif';

function theme(name: string, t: Record<string, string>) {
  const hex = (token: string) => {
    const v = t[token];
    if (!v) throw new Error(`token --${token} missing`);
    return oklchToHex(v);
  };
  const solid = (color: string) => ({ solid: { color } });
  return {
    name,
    dataColors: [
      hex('chart-1'),
      hex('chart-2'),
      hex('chart-3'),
      hex('chart-4'),
      hex('chart-5'),
      hex('primary'),
      hex('terracotta'),
      hex('info'),
    ],
    foreground: hex('foreground'),
    foregroundNeutralSecondary: hex('muted-foreground'),
    background: hex('card'),
    backgroundLight: hex('muted'),
    backgroundNeutral: hex('border'),
    tableAccent: hex('primary'),
    good: hex('success'),
    neutral: hex('warning'),
    bad: hex('destructive'),
    maximum: hex('primary'),
    center: hex('gold'),
    minimum: hex('accent'),
    hyperlink: hex('primary'),
    textClasses: {
      callout: { fontSize: 28, fontFace: SERIF, color: hex('foreground') },
      title: { fontSize: 13, fontFace: SANS, color: hex('foreground') },
      header: { fontSize: 12, fontFace: SANS, color: hex('foreground') },
      label: { fontSize: 10, fontFace: SANS, color: hex('muted-foreground') },
    },
    visualStyles: {
      '*': {
        '*': {
          background: [{ show: true, color: solid(hex('card')), transparency: 0 }],
          border: [{ show: true, color: solid(hex('border')), radius: 12 }],
          dropShadow: [{ show: false }],
          title: [{ fontColor: solid(hex('foreground')), fontFamily: SANS, fontSize: 12 }],
          visualHeader: [
            { foreground: solid(hex('muted-foreground')), background: solid(hex('card')) },
          ],
        },
      },
      // Transparent page: the report sits on the back office's own card.
      page: {
        '*': {
          background: [{ transparency: 100 }],
          outspace: [{ color: solid(hex('background')), transparency: 100 }],
        },
      },
    },
  };
}

export function buildThemes(css = readFileSync(THEME_CSS, 'utf8')) {
  return {
    light: theme('AgriCoop', tokens(css, ':root')),
    dark: theme('AgriCoop (sombre)', { ...tokens(css, ':root'), ...tokens(css, '.dark') }),
  };
}

export const serialize = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

// Run directly: write both files.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const themes = buildThemes();
  for (const file of OUTPUT.light) writeFileSync(file, serialize(themes.light));
  for (const file of OUTPUT.dark) writeFileSync(file, serialize(themes.dark));
  console.warn('Wrote the Power BI themes (src/analytics/powerbi and public/)');
}
