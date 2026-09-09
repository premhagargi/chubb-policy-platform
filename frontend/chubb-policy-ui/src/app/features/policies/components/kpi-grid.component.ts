import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PolicySummary } from '../../../core/models/policy-summary.model';
import { IconComponent, IconName } from '../../../shared/ui/icon.component';
import { formatCompactCurrency, formatNumber } from '../../../shared/utils/format';

interface Kpi {
  label: string;
  value: string;
  caption: string;
  icon: IconName;
  accent: string;
  /** Filter to apply when the tile is used as a shortcut into the list. */
  filter: Record<string, string> | null;
}

/**
 * Portfolio KPIs, all derived from GET /policies/summary under the current filters.
 *
 * Deliberately no trend percentages: the API exposes no historical data, and inventing
 * "↑ 4.2% vs last month" would put fabricated business numbers in front of stakeholders.
 */
@Component({
  selector: 'app-kpi-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      @if (loading()) {
        @for (i of [1, 2, 3, 4]; track i) {
          <div class="surface-card p-4">
            <div class="skeleton h-3 w-24"></div>
            <div class="skeleton mt-3 h-7 w-20"></div>
            <div class="skeleton mt-2.5 h-3 w-28"></div>
          </div>
        }
      } @else {
        @for (kpi of kpis(); track kpi.label) {
          <button
            type="button"
            class="surface-card group p-4 text-left transition-all hover:border-[var(--border-strong)] hover:shadow-sm"
            [class.cursor-default]="!kpi.filter"
            (click)="kpi.filter && select.emit(kpi.filter)"
            [attr.aria-label]="
              kpi.filter ? 'Filter policies by ' + kpi.label : kpi.label + ': ' + kpi.value
            "
          >
            <div class="flex items-start justify-between gap-2">
              <p
                class="text-[11px] font-medium uppercase tracking-wide"
                style="color: var(--text-muted);"
              >
                {{ kpi.label }}
              </p>
              <span
                class="flex h-6 w-6 items-center justify-center rounded-md"
                [style.background]="kpi.accent + '14'"
                [style.color]="kpi.accent"
              >
                <app-icon [name]="kpi.icon" [size]="14" />
              </span>
            </div>
            <p
              class="tabular mt-2 text-[26px] font-semibold leading-none tracking-tight"
              style="color: var(--text);"
            >
              {{ kpi.value }}
            </p>
            <p class="mt-2 text-xs" style="color: var(--text-subtle);">{{ kpi.caption }}</p>
          </button>
        }
      }
    </div>
  `,
})
export class KpiGridComponent {
  readonly summary = input<PolicySummary | null>(null);
  readonly loading = input(false);
  readonly select = output<Record<string, string>>();

  protected readonly kpis = computed<Kpi[]>(() => {
    const s = this.summary();
    if (!s) return [];

    const totalPremium = Object.values(s.premiumByLineOfBusiness).reduce((a, b) => a + b, 0);
    const active = s.countsByStatus['Active'] ?? 0;
    const activeShare = s.totalCount > 0 ? Math.round((active / s.totalCount) * 100) : 0;

    const tiles: Kpi[] = [
      {
        label: 'Total Policies',
        value: formatNumber(s.totalCount),
        caption: 'Matching current filters',
        icon: 'policies',
        accent: '#4b5563',
        filter: null,
      },
      {
        label: 'Active',
        value: formatNumber(active),
        caption: `${activeShare}% of portfolio`,
        icon: 'check',
        accent: 'var(--status-active)',
        filter: { status: 'Active' },
      },
      {
        label: 'Expiring in 30 Days',
        value: formatNumber(s.expiringSoonCount),
        caption: 'Active policies nearing expiry',
        icon: 'clock',
        accent: '#9a6206',
        filter: null,
      },
      {
        label: 'Flagged for Review',
        value: formatNumber(s.flaggedCount),
        caption: totalPremium > 0 ? `${formatCompactCurrency(totalPremium)} total premium` : '—',
        icon: 'flag',
        accent: 'var(--flag)',
        filter: { flagged: 'true' },
      },
    ];
    return tiles;
  });
}
