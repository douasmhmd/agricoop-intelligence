/*
 * Self-hosted fonts (no CDN), all `font-display: swap` and split by unicode-range: a browser only
 * downloads the subsets the page actually renders (the Arabic files only in Arabic, for example).
 *
 *   Display  Fraunces (variable, optical size axis) → --font-display
 *   UI/body  Manrope (variable)                     → --font-sans
 *   Arabic   IBM Plex Sans Arabic (body) + Noto Kufi Arabic (display), reached through the font
 *            stacks: the Latin faces have no Arabic glyphs, so Arabic text falls through to them.
 *
 * Import once per app, before the CSS: `import '@agricoop/ui/fonts';`
 */
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/manrope/index.css';
import '@fontsource-variable/noto-kufi-arabic/index.css';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
