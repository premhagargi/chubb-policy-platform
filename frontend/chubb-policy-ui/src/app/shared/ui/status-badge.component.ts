import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Status pill. A coloured dot carries the same information as the tint, so status is
 *  never communicated by colour alone. */
@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
      [style.background]="tokens().bg"
      [style.color]="tokens().fg"
    >
      <span class="h-1.5 w-1.5 rounded-full" [style.background]="tokens().fg"></span>
      {{ status() }}
    </span>
  `,
})
export class StatusBadgeComponent {
  readonly status = input.required<string>();

  protected readonly tokens = computed(() => {
    switch (this.status()) {
      case 'Active':
        return { bg: 'var(--status-active-bg)', fg: 'var(--status-active)' };
      case 'Pending':
        return { bg: 'var(--status-pending-bg)', fg: 'var(--status-pending)' };
      case 'Cancelled':
        return { bg: 'var(--status-cancelled-bg)', fg: 'var(--status-cancelled)' };
      default:
        return { bg: 'var(--status-expired-bg)', fg: 'var(--status-expired)' };
    }
  });
}
