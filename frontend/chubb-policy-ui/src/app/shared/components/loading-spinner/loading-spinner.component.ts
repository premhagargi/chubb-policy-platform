import { Component } from '@angular/core';

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  template: `
    <div class="loading" role="status" aria-live="polite">
      <span class="spinner" aria-hidden="true"></span>
      <span>Loading policies…</span>
    </div>
  `,
  styles: [
    `
      .loading {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-5);
        color: var(--color-text-muted);
      }
      .spinner {
        width: 1.25rem;
        height: 1.25rem;
        border: 3px solid var(--color-border);
        border-top-color: var(--color-accent);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `
  ]
})
export class LoadingSpinnerComponent {}
