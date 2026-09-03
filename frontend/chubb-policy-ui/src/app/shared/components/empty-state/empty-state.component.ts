import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <div class="empty" role="status" aria-live="polite">
      <p>{{ message }}</p>
    </div>
  `,
  styles: [
    `
      .empty {
        padding: var(--space-6);
        text-align: center;
        color: var(--color-text-muted);
      }
    `
  ]
})
export class EmptyStateComponent {
  @Input() message = 'No policies match the current filters.';
}
