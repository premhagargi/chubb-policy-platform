import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { PolicySummary } from '../../../core/models/policy-summary.model';
import { formatCompactCurrency, formatNumber } from '../../../shared/utils/format';

type Mode = 'premium' | 'region';

interface Bar {
  label: string;
  value: number;
  display: string;
  pct: number;
}

/**
 * Portfolio distribution. The API exposes no time series, so rather than fabricate a
 * volume-over-time line chart this shows two real cuts of the data the summary does
 * provide: premium by line of business, and policy count by region.
 */
@Component({
  standalone: true,
  selector: 'app-distribution-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="surface-card flex flex-col p-5 min-h-[350px]">
      <header class="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 class="text-[13px] font-semibold" style="color: var(--text);">
            Portfolio Distribution
          </h2>
          <p class="text-xs" style="color: var(--text-muted);">
            {{
              mode() === 'premium'
                ? 'Written premium by line of business'
                : 'Policy count by region'
            }}
          </p>
        </div>

        <div
          class="flex shrink-0 rounded-md p-0.5"
          style="background: var(--surface-hover);"
          role="tablist"
          aria-label="Distribution metric"
        >
          @for (option of modes; track option.value) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="mode() === option.value"
              class="rounded px-2 py-1 text-[11px] font-medium transition-colors"
              [style.background]="mode() === option.value ? 'var(--surface)' : 'transparent'"
              [style.color]="mode() === option.value ? 'var(--text)' : 'var(--text-muted)'"
              [style.box-shadow]="mode() === option.value ? '0 1px 2px rgb(0 0 0 / 0.06)' : 'none'"
              (click)="mode.set(option.value)"
            >
              {{ option.label }}
            </button>
          }
        </div>
      </header>

      @if (loading()) {
        <div class="flex-1 space-y-3 py-2">
          @for (i of [1, 2, 3, 4]; track i) {
            <div>
              <div class="skeleton mb-1.5 h-3 w-32"></div>
              <div class="skeleton h-2 w-full"></div>
            </div>
          }
        </div>
      } @else if (bars().length === 0) {
        <p
          class="flex flex-1 items-center justify-center py-8 text-sm"
          style="color: var(--text-subtle);"
        >
          No data for the current filters
        </p>
      } @else {
        <ul class="flex-1 space-y-3 py-1">
          @for (bar of bars(); track bar.label) {
            <li>
              <div class="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
                <span class="truncate" style="color: var(--text-muted);">{{ bar.label }}</span>
                <span class="tabular shrink-0 font-medium" style="color: var(--text);">{{
                  bar.display
                }}</span>
              </div>
              <div
                class="h-1.5 w-full overflow-hidden rounded-full"
                style="background: var(--surface-hover);"
                role="img"
                [attr.aria-label]="bar.label + ': ' + bar.display + ', ' + bar.pct + '% of total'"
              >
                <div
                  class="h-full rounded-full transition-[width] duration-500"
                  [style.width.%]="bar.pct"
                  style="background: var(--brand);"
                ></div>
              </div>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class DistributionChartComponent {
  readonly summary = input<PolicySummary | null>(null);
  readonly loading = input(false);

  protected readonly mode = signal<Mode>('premium');
  protected readonly modes: { value: Mode; label: string }[] = [
    { value: 'premium', label: 'Premium' },
    { value: 'region', label: 'Region' },
  ];

  protected readonly bars = computed<Bar[]>(() => {
    const s = this.summary();
    if (!s) return [];

    const source =
      this.mode() === 'premium'
        ? Object.entries(s.premiumByLineOfBusiness)
        : Object.entries(s.countsByRegion);

    const entries = source.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const max = Math.max(...entries.map(([, v]) => v), 0);
    if (max === 0) return [];

    return entries.map(([label, value]) => ({
      label,
      value,
      display:
        this.mode() === 'premium' ? formatCompactCurrency(value) : formatNumber(value),
      pct: Math.round((value / max) * 100),
    }));
  });
}
