/* The bench's theme: one control at the end of the nav on every page, kept in the browser so it holds from page to
 * page and in every tab. Where it is kept, and what a page embedded in another is handed, is theme-boot.js, which each
 * page's head runs before anything paints; this adds the control. */
declare global {
  var benchTheme: { key: string; handed: string | null; kept(): string; set(theme: string): void };
}
const { key: KEY, handed, kept } = benchTheme;

/** Set the theme, and tell a page that reads its tokens for the theme to read them again. */
function apply(theme: string): void {
  benchTheme.set(theme);
  dispatchEvent(new Event('benchtheme'));
}

const nav = document.querySelector('nav');
if (nav && handed == null) {
  const set = nav.appendChild(document.createElement('fieldset'));
  set.className = 'theme';
  set.innerHTML = '<legend>Theme</legend>' + ['', 'light', 'dark'].map((v) => `<label><input type="radio" name="bench-theme" value="${v}"> ${v || 'system'}</label>`).join('');
  const show = (theme: string) => { const radio = set.querySelector<HTMLInputElement>(`[value="${theme}"]`); if (radio) radio.checked = true; };
  show(kept());
  set.addEventListener('change', (e) => {
    const theme = (e.target as HTMLInputElement).value;
    try { localStorage.setItem(KEY, theme); } catch { /* not kept, as in a private window: it holds on this page */ }
    apply(theme);
  });
  // Another tab moved it.
  addEventListener('storage', (e) => { if (e.key === KEY) { show(e.newValue ?? ''); apply(e.newValue ?? ''); } });
}
apply(handed ?? kept());
