// Applies the saved theme before the first paint (no light flash in dark mode). Kept as a file, not
// an inline script, because the Content-Security-Policy only allows scripts from 'self'.
// Same storage key as ThemeProvider in @agricoop/ui.
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
})();
