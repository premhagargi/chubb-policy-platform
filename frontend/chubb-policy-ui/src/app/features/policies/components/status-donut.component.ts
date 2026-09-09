import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PolicySummary } from '../../../core/models/policy-summary.model';
import { formatNumber } from '../../../shared/utils/format';

interface Segment {
  label: string;
  count: number;
  pct: number;
  color: string;
  dash: number;
  offset: number;
}

const STATUS_COLORS: Record<string, string> = {
  Active: 'var(--status-active)',
  Pending: 'var(--status-pending)',
  Expired: 'var(--status-expired)',
  Cancelled: 'var(--status-cancelled)',
};

const RADIUS = 84;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Status mix as a donut. Percentages are computed from countsByStatus — no invented data. */
@Component({
  selector: 'app-status-donut',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="surface-card flex flex-col p-5 min-h-[350px]">
      <header class="mb-1">
        <h2 class="text-[13px] font-semibold" style="color: var(--text);">Status Distribution</h2>
        <p class="text-xs" style="color: var(--text-muted);">Policy mix across lifecycle states</p>
      </header>

      @if (loading()) {
        <div class="flex flex-1 items-center gap-6 py-4">
          <div class="skeleton h-[200px] w-[200px] shrink-0 rounded-full"></div>
          <div class="flex-1 space-y-3">
            @for (i of [1, 2, 3, 4]; track i) {
              <div class="skeleton h-4 w-full"></div>
            }
          </div>
        </div>
      } @else if (total() === 0) {
        <p class="flex flex-1 items-center justify-center py-8 text-sm" style="color: var(--text-subtle);">
          No data for the current filters
        </p>
      } @else {
        <div class="flex flex-1 flex-col items-center gap-6 py-5 sm:flex-row sm:gap-8">
          <div class="relative shrink-0">
            <svg width="200" height="200" viewBox="0 0 200 200" role="img" [attr.aria-label]="ariaLabel()">
              <circle cx="100" cy="100" [attr.r]="radius" fill="none" stroke="var(--border)" stroke-width="20" />
              @for (seg of segments(); track seg.label) {
                <circle
                  cx="100"
                  cy="100"
                  [attr.r]="radius"
                  fill="none"
                  [attr.stroke]="seg.color"
                  stroke-width="20"
                  [attr.stroke-dasharray]="seg.dash + ' ' + (circumference - seg.dash)"
                  [attr.stroke-dashoffset]="seg.offset"
                  transform="rotate(-90 100 100)"
                  stroke-linecap="butt"
                />
              }
            </svg>
            <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span class="tabular text-3xl font-semibold leading-none" style="color: var(--text);">{{
                formatNumber(total())
              }}</span>
              <span class="mt-1 text-[13px]" style="color: var(--text-muted);">policies</span>
            </div>
          </div>

          <ul class="w-full flex-1 space-y-1">
            @for (seg of segments(); track seg.label) {
              <li class="flex items-center gap-2.5 text-[13px]">
                <span class="h-2 w-2 shrink-0 rounded-full" [style.background]="seg.color"></span>
                <span class="flex-1" style="color: var(--text-muted);">{{ seg.label }}</span>
                <span class="tabular font-medium" style="color: var(--text);">{{
                  formatNumber(seg.count)
                }}</span>
                <span class="tabular w-10 text-right" style="color: var(--text-subtle);"
                  >{{ seg.pct }}%</span
                >
              </li>
            }
          </ul>
        </div>
      }
    </section>
  `,
})
export class StatusDonutComponent {
  readonly summary = input<PolicySummary | null>(null);
  readonly loading = input(false);

  protected readonly radius = RADIUS;
  protected readonly circumference = CIRCUMFERENCE;
  protected readonly formatNumber = formatNumber;

  protected readonly total = computed(() => {
    const counts = this.summary()?.countsByStatus ?? {};
    return Object.values(counts).reduce((a, b) => a + b, 0);
  });

  protected readonly segments = computed<Segment[]>(() => {
    const counts = this.summary()?.countsByStatus ?? {};
    const total = this.total();
    if (total === 0) return [];

    let cumulative = 0;
    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => {
        const fraction = count / total;
        const dash = fraction * CIRCUMFERENCE;
        const offset = -cumulative * CIRCUMFERENCE;
        cumulative += fraction;
        return {
          label,
          count,
          pct: Math.round(fraction * 100),
          color: STATUS_COLORS[label] ?? 'var(--text-subtle)',
          dash,
          offset,
        };
      });
  });

  protected readonly ariaLabel = computed(
    () =>
      'Status distribution: ' +
      this.segments()
        .map((s) => `${s.label} ${s.pct} percent`)
        .join(', ')
  );
}
