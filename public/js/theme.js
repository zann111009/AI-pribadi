const THEME_KEY = 'ai-pribadi-theme';

class ThemeManager {
  constructor() {
    this.toggleBtns = document.querySelectorAll('.theme-toggle-btn');
    this.sunIcon = document.getElementById('sidebarThemeIconSun');
    this.moonIcon = document.getElementById('sidebarThemeIconMoon');
    this.media = window.matchMedia('(prefers-color-scheme: dark)');
    this.current = document.documentElement.getAttribute('data-theme') || 'light';

    this.toggleBtns.forEach((btn) => {
      btn.addEventListener('click', () => this.toggle());
    });

    if (this.media.addEventListener) {
      this.media.addEventListener('change', (e) => {
        if (this.getSaved() === null) this.apply(e.matches ? 'dark' : 'light');
      });
    } else if (this.media.addListener) {
      this.media.addListener((e) => {
        if (this.getSaved() === null) this.apply(e.matches ? 'dark' : 'light');
      });
    }

    this.sync();

    window.themeManager = this;
  }

  getSaved() {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch (e) {
      return null;
    }
  }

  save(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {
      return;
    }
  }

  apply(theme) {
    this.current = theme;
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b1020' : '#f6f7fb');
    this.sync();
  }

  sync() {
    const isDark = this.current === 'dark';
    if (this.toggleBtn) {
      this.toggleBtn.title = isDark ? 'Mode terang' : 'Mode gelap';
      this.toggleBtn.setAttribute('aria-label', isDark ? 'Mode terang' : 'Mode gelap');
      this.toggleBtn.setAttribute('aria-pressed', String(isDark));
    }
  }

  toggle() {
    const next = this.current === 'dark' ? 'light' : 'dark';
    this.save(next);
    this.apply(next);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ThemeManager();
});