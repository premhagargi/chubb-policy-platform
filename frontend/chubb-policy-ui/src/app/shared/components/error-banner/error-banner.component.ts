import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-error-banner',
  standalone: true,
  template: `
    <div class="error-banner" role="alert" aria-live="assertive">
      <strong>Something went wrong.</strong>
      <span>{{ message }}</span>
    </div>
  `,
  styles: [
    `
      .error-banner {
        display: flex;
        gap: var(--space-2);
        padding: var(--space-4);
        margin: var(--space-4) 0;
        background: var(--color-danger-bg);
        color: var(--color-danger);
        border: 1px solid var(--color-danger);
        border-radius: var(--radius-md);
      }
    `
  ]
})
export class ErrorBannerComponent {
  @Input() message = 'Please try again.';
}
