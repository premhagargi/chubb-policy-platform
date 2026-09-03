import { Component, inject } from '@angular/core';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  template: `
    <button
      type="button"
      class="theme-toggle"
      [attr.aria-pressed]="theme.resolvedTheme() === 'dark'"
      [attr.aria-label]="'Switch to ' + (theme.resolvedTheme() === 'dark' ? 'light' : 'dark') + ' mode'"
      (click)="theme.toggle()"
    >
      {{ theme.resolvedTheme() === 'dark' ? '☀️ Light' : '🌙 Dark' }}
    </button>
  `,
  styles: [
    `
      .theme-toggle {
        background: var(--color-surface);
        color: var(--color-text);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        padding: var(--space-2) var(--space-3);
        cursor: pointer;
      }
      .theme-toggle:hover {
        background: var(--color-surface-raised);
      }
    `
  ]
})
export class ThemeToggleComponent {
  protected readonly theme = inject(ThemeService);
}
