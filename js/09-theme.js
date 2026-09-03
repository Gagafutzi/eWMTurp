/* attential-shield-theme-controller */
/* ================================================================
   ATTENTIONAL SHIELD // THEME CONTROLLER
   Additive-only UI feature.
   ================================================================ */
(function initThemeToggle() {
  const STORAGE_KEY = 'attentional-shield-theme';

  const getPreferredTheme = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;

    return window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  };

  const applyTheme = theme => {
    const safeTheme = theme === 'light' ? 'light' : 'dark';

    document.body.setAttribute('data-theme', safeTheme);

    const button = document.getElementById('theme-toggle');
    if (!button) return;

    const isLight = safeTheme === 'light';

    button.setAttribute(
      'aria-label',
      isLight ? 'Switch to dark mode' : 'Switch to light mode'
    );
    button.setAttribute(
      'title',
      isLight ? 'Switch to dark mode' : 'Switch to light mode'
    );
    button.setAttribute('aria-pressed', String(isLight));

    const icon = button.querySelector('.theme-icon');
    const label = button.querySelector('.theme-label');

    if (icon) icon.textContent = isLight ? '☀' : '☾';
    if (label) label.textContent = isLight ? 'LIGHT' : 'DARK';
  };

  const createToggle = () => {
    if (!document.body || document.getElementById('theme-toggle')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'theme-toggle';
    button.innerHTML =
      '<span class="theme-icon" aria-hidden="true"></span>' +
      '<span class="theme-label"></span>';

    button.addEventListener('click', () => {
      const next =
        document.body.getAttribute('data-theme') === 'light'
          ? 'dark'
          : 'light';

      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
    });

    document.body.appendChild(button);
    applyTheme(getPreferredTheme());

    const activeScreen = document.querySelector('.screen.active');
    button.style.display = activeScreen && activeScreen.id === 'screen-setup'
      ? 'inline-flex'
      : 'none';
  };

  const bootTheme = () => {
    applyTheme(getPreferredTheme());
    createToggle();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootTheme, { once:true });
  } else {
    bootTheme();
  }
})();
