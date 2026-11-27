// Applies the saved theme before the first paint (no light flash in dark mode) and decides whether
// the pre-rendered home shell may show. Kept as a file, not an inline script, because the
// Content-Security-Policy only allows scripts from 'self'. Loaded in <head>.
// Same storage keys as ThemeProvider (@agricoop/ui) and src/i18n.
(function () {
  try {
    var pref = localStorage.getItem('agricoop.theme');
    var dark =
      pref === 'dark' ||
      ((pref === null || pref === 'system') &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {
    // Storage blocked: the system preference applies once the app starts.
  }
  // The shell (scripts/prerender.mjs) is the French home page: show it only there.
  try {
    var lang = null;
    try {
      lang = localStorage.getItem('agricoop.lang');
    } catch (e) {
      // Storage blocked: the app starts in French.
    }
    if (location.pathname === '/' && lang !== 'ar') {
      document.documentElement.classList.add('prerendered');
    }
  } catch (e) {
    // Never block the page for the shell.
  }
})();
