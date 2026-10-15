/* The theme the bench keeps, set before the page paints. vite.config.ts writes this into the head of every page, and
 * theme.ts adds the control. A page embedded in another (the marks page's halves) is handed its theme in the URL and
 * keeps nothing. Anything but light or dark is the system's. */
var benchTheme = {
  key: 'ua-bench-theme',
  handed: new URLSearchParams(location.search).has('embed') ? new URLSearchParams(location.search).get('theme') : null,
  kept: function () { try { return localStorage.getItem(benchTheme.key) || ''; } catch (e) { return ''; } },
  set: function (theme) { if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme; else delete document.documentElement.dataset.theme; },
};
benchTheme.set(benchTheme.handed != null ? benchTheme.handed : benchTheme.kept());
