import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme-preference';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  // inject() field, declared first: class field initializers run top-to-bottom before
  // the constructor body, so a constructor-parameter-injected `storage` would still be
  // undefined when the `preference` initializer below runs. inject() has no such
  // ordering hazard.
  private readonly storage = inject(StorageService);

  readonly preference = signal<ThemePreference>(this.readInitialPreference());

  // Tracked as its own signal (rather than read imperatively inside a computed) so a
  // system theme change while `preference === 'system'` is itself reactive.
  private readonly systemPrefersDark = signal(this.getSystemPrefersDark());

  /** The theme actually applied — resolves 'system' against the OS media query.
   * A plain `computed`, not a signal set via `effect()`: effects run asynchronously
   * (batched into the next reactivity flush), which made this unit-testable only with
   * an artificial tick. A computed re-evaluates synchronously on read, so setPreference
   * followed immediately by reading resolvedTheme (as the tests, and the template
   * bindings, both do) always sees the up-to-date value. */
  readonly resolvedTheme = computed<'light' | 'dark'>(() =>
    this.preference() === 'system' ? (this.systemPrefersDark() ? 'dark' : 'light') : (this.preference() as 'light' | 'dark')
  );

  constructor() {
    // Cosmetic DOM side effect only — fine to run on the next reactivity flush.
    effect(() => {
      document.documentElement.setAttribute('data-theme', this.resolvedTheme());
    });

    if (typeof window !== 'undefined' && window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        this.systemPrefersDark.set(e.matches);
      });
    }
  }

  setPreference(pref: ThemePreference): void {
    this.preference.set(pref);
    this.storage.set(STORAGE_KEY, pref);
  }

  toggle(): void {
    this.setPreference(this.resolvedTheme() === 'dark' ? 'light' : 'dark');
  }

  private readInitialPreference(): ThemePreference {
    return this.storage.get<ThemePreference>(STORAGE_KEY) ?? 'system';
  }

  private getSystemPrefersDark(): boolean {
    return typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false;
  }
}
