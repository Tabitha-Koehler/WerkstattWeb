import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'werkstattweb-theme';

  readonly isDark = signal<boolean>(false);

  constructor() {
    this.applyStoredTheme();
  }

  toggle(): void {
    this.setTheme(this.isDark() ? 'light' : 'dark');
  }

  setTheme(mode: ThemeMode): void {
    const dark = mode === 'dark';
    this.isDark.set(dark);
    localStorage.setItem(this.STORAGE_KEY, mode);
    this.applyToDom(dark);
  }

  private applyStoredTheme(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY) as ThemeMode | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = stored ? stored === 'dark' : prefersDark;
    this.isDark.set(dark);
    this.applyToDom(dark);
  }

  private applyToDom(dark: boolean): void {
    document.documentElement.classList.toggle('dark', dark);
  }
}
