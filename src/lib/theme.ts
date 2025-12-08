import browser from 'webextension-polyfill';

type Theme = 'light' | 'dark' | 'auto';

export class ThemeManager {
  private static readonly STORAGE_KEY = 'mrplug_theme';

  static async getTheme(): Promise<Theme> {
    try {
      const result = await browser.storage.local.get(this.STORAGE_KEY);
      return (result[this.STORAGE_KEY] as Theme) || 'auto';
    } catch {
      return 'auto';
    }
  }

  static async setTheme(theme: Theme): Promise<void> {
    await browser.storage.local.set({ [this.STORAGE_KEY]: theme });
    this.applyTheme(theme);
  }

  static applyTheme(theme: Theme) {
    const root = document.documentElement;

    if (theme === 'auto') {
      // Remove explicit theme attribute to use browser preference
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }

  static getSystemTheme(): 'light' | 'dark' {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  static getEffectiveTheme(theme: Theme): 'light' | 'dark' {
    if (theme === 'auto') {
      return this.getSystemTheme();
    }
    return theme;
  }

  static async initTheme() {
    const theme = await this.getTheme();
    this.applyTheme(theme);

    // Listen for system theme changes when in auto mode
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
      const currentTheme = await this.getTheme();
      if (currentTheme === 'auto') {
        // Trigger re-render by removing and re-adding attribute
        this.applyTheme('auto');
      }
    });
  }
}
