import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';
import { StorageService } from './storage.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to system preference when nothing is stored', () => {
    const service = TestBed.inject(ThemeService);
    expect(['light', 'dark']).toContain(service.resolvedTheme());
  });

  it('persists an explicit preference via StorageService', () => {
    const service = TestBed.inject(ThemeService);
    const storage = TestBed.inject(StorageService);

    service.setPreference('dark');

    expect(storage.get('theme-preference')).toBe('dark');
    expect(service.resolvedTheme()).toBe('dark');
  });

  it('toggle flips between light and dark', () => {
    const service = TestBed.inject(ThemeService);

    service.setPreference('light');
    service.toggle();
    expect(service.resolvedTheme()).toBe('dark');

    service.toggle();
    expect(service.resolvedTheme()).toBe('light');
  });
});
