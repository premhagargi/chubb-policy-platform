import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Policy } from '../../core/models/policy.model';
import { PolicyFilter } from '../../core/models/policy-filter.model';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { formatCurrency, formatDate, formatRelativeTime } from '../../shared/utils/format';
import { AiAssistantDrawerComponent } from './components/ai-assistant-drawer.component';
import { DistributionChartComponent } from './components/distribution-chart.component';
import { FlagDialogComponent } from './components/flag-dialog.component';
import { KpiGridComponent } from './components/kpi-grid.component';
import { PolicyDetailDrawerComponent } from './components/policy-detail-drawer.component';
import { PolicyPaginationComponent } from './components/policy-pagination.component';
import { PolicyTableComponent } from './components/policy-table.component';
import { PolicyToolbarComponent } from './components/policy-toolbar.component';
import { StatusDonutComponent } from './components/status-donut.component';
import { PolicyStateService } from './policy-state.service';

/**
 * The policy workspace. One page serves Dashboard / Policies / Flagged / Analytics —
 * they differ only in which sections are visible and which filter they seed, so the
 * table, filters and drawer behave identically everywhere.
 */
@Component({
  standalone: true,
  selector: 'app-policies-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PolicyStateService],
  imports: [
    IconComponent,
    KpiGridComponent,
    StatusDonutComponent,
    DistributionChartComponent,
    PolicyToolbarComponent,
    PolicyTableComponent,
    PolicyPaginationComponent,
    PolicyDetailDrawerComponent,
    FlagDialogComponent,
    AiAssistantDrawerComponent,
  ],
  template: `
    <div class="mx-auto max-w-[1600px] p-4 lg:p-6">
      <!-- Page header -->
      <header class="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-[22px] font-semibold tracking-tight" style="color: var(--text);">
            {{ title() }}
          </h1>
          <p class="mt-0.5 text-[13px]" style="color: var(--text-muted);">{{ subtitle() }}</p>
        </div>

        <div class="flex items-center gap-2">
          @if (state.lastUpdated(); as updated) {
            <span class="text-xs" style="color: var(--text-subtle);">
              Last updated {{ relativeTime(updated) }}
            </span>
          }
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-md border transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-50"
            style="background: var(--surface); border-color: var(--border); color: var(--text-muted);"
            [disabled]="state.status() === 'loading'"
            (click)="refresh()"
            aria-label="Refresh data"
          >
            <span [class.animate-spin]="state.status() === 'loading'">
              <app-icon name="refresh" [size]="15" />
            </span>
          </button>
        </div>
      </header>

      @if (state.status() === 'error') {
        <!-- Error state -->
        <div class="surface-card flex flex-col items-center justify-center px-6 py-16 text-center">
          <span
            class="flex h-11 w-11 items-center justify-center rounded-full"
            style="background: var(--accent-bg); color: var(--accent);"
          >
            <app-icon name="alert" [size]="22" />
          </span>
          <h2 class="mt-3.5 text-[15px] font-semibold" style="color: var(--text);">
            Unable to load policies
          </h2>
          <p class="mt-1 max-w-sm text-[13px]" style="color: var(--text-muted);">
            Something went wrong while retrieving policy data. Please try again.
          </p>
          <button
            type="button"
            class="mt-4 h-9 rounded-md px-4 text-[13px] font-medium transition-opacity hover:opacity-90"
            style="background: var(--brand); color: var(--brand-contrast);"
            (click)="refresh()"
          >
            Try again
          </button>
        </div>
      } @else {
        @if (showOverview()) {
          <div class="mb-4">
            <app-kpi-grid
              [summary]="state.summary()"
              [loading]="state.isFirstLoad()"
              (select)="applyKpiFilter($event)"
            />
          </div>

          <div class="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <app-status-donut [summary]="state.summary()" [loading]="state.isFirstLoad()" />
            <app-distribution-chart [summary]="state.summary()" [loading]="state.isFirstLoad()" />
          </div>
        }


        @if (showTable()) {
          <section class="surface-card overflow-hidden">
            <app-policy-toolbar
              [filter]="state.filter()"
              [activeCount]="state.activeFilters()"
              [lockedKeys]="lockedKeys()"
              [searching]="state.status() === 'loading'"
              (change)="state.patchFilter($event)"
              (clearAll)="state.clearFilters()"
              (clearOne)="clearOne($event)"
              (exportCsv)="exportCsv()"
            />

            <!-- Bulk actions -->
            @if (state.hasSelection()) {
              <div
                class="animate-fade-in flex flex-wrap items-center gap-3 px-4 py-2.5"
                style="background: color-mix(in srgb, var(--brand) 6%, var(--surface)); border-bottom: 1px solid var(--border);"
              >
                <p class="text-[13px] font-medium" style="color: var(--text);">
                  {{ state.selectedCount() }}
                  {{ state.selectedCount() === 1 ? 'policy' : 'policies' }} selected
                </p>
                <div class="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    class="h-8 rounded-md px-3 text-[13px] font-medium transition-colors hover:bg-[var(--surface-hover)]"
                    style="color: var(--text-muted);"
                    (click)="state.clearSelection()"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    class="flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-opacity hover:opacity-90"
                    style="background: var(--brand); color: var(--brand-contrast);"
                    (click)="openBulkFlag()"
                  >
                    <app-icon name="flag" [size]="14" />
                    Flag policies
                  </button>
                </div>
              </div>
            }

            @if (isEmpty()) {
              <!-- Empty state -->
              <div class="flex flex-col items-center justify-center px-6 py-16 text-center">
                <span
                  class="flex h-11 w-11 items-center justify-center rounded-full"
                  style="background: var(--surface-hover); color: var(--text-subtle);"
                >
                  <app-icon name="inbox" [size]="22" />
                </span>
                <h3 class="mt-3.5 text-[15px] font-semibold" style="color: var(--text);">
                  No policies found
                </h3>
                <p class="mt-1 max-w-sm text-[13px]" style="color: var(--text-muted);">
                  @if (state.activeFilters() > 0) {
                    No policies match the current filters. Try adjusting or clearing them.
                  } @else {
                    There are no policies in the portfolio yet.
                  }
                </p>
                @if (state.activeFilters() > 0 && lockedKeys().length === 0) {
                  <button
                    type="button"
                    class="mt-4 h-9 rounded-md border px-4 text-[13px] font-medium transition-colors hover:bg-[var(--surface-hover)]"
                    style="background: var(--surface); border-color: var(--border); color: var(--text);"
                    (click)="state.clearFilters()"
                  >
                    Clear filters
                  </button>
                }
              </div>
            } @else {
              <app-policy-table
                [rows]="state.items()"
                [selectedIds]="state.selectedIds()"
                [sort]="state.filter().sort"
                [loading]="state.isFirstLoad()"
                [allSelected]="state.allOnPageSelected()"
                [someSelected]="state.someOnPageSelected()"
                (sortBy)="state.toggleSort($event)"
                (toggleRow)="state.toggleRow($event)"
                (toggleAll)="state.toggleAllOnPage()"
                (rowClick)="state.openDetail($event)"
              />

              <app-policy-pagination
                [page]="state.filter().page"
                [size]="state.filter().size"
                [totalPages]="state.totalPages()"
                [total]="state.totalCount()"
                [from]="state.range().from"
                [to]="state.range().to"
                (pageChange)="state.setPage($event)"
                (sizeChange)="state.setPageSize($event)"
              />
            }
          </section>
        }
      }
    </div>

    <!-- Floating launcher. Hidden while the panel is open so it never sits on top
         of the panel it opened. -->
    @if (!assistantOpen()) {
      <button
        type="button"
        class="copilot-fab fixed bottom-5 right-5 z-40 flex h-12 items-center gap-2 rounded-full pl-3.5 pr-4 text-[13px] font-medium shadow-lg transition-transform hover:scale-[1.03]"
        style="background: var(--brand); color: var(--brand-contrast);"
        aria-controls="policy-copilot"
        [attr.aria-expanded]="false"
        (click)="assistantOpen.set(true)"
      >
        <app-icon name="sparkle" [size]="18" />
        <span class="hidden sm:inline">Ask Copilot</span>
      </button>
    }

    <app-ai-assistant-drawer
      id="policy-copilot"
      [open]="assistantOpen()"
      [filter]="state.filter()"
      (close)="assistantOpen.set(false)"
    />

    <app-policy-detail-drawer
      [policy]="state.detail()"
      [loading]="state.detailLoading()"
      [flagInFlight]="state.flagInFlight()"
      (close)="state.closeDetail()"
      (flag)="openSingleFlag($event)"
    />

    <app-flag-dialog
      [open]="flagDialogOpen()"
      [count]="pendingFlagIds().length"
      [busy]="state.flagInFlight()"
      (confirm)="confirmFlag()"
      (cancel)="flagDialogOpen.set(false)"
    />
  `,
  styles: [
    `
      .copilot-fab {
        animation: fab-in 200ms ease-out;
      }

      @keyframes fab-in {
        from {
          opacity: 0;
          transform: scale(0.85) translateY(6px);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .copilot-fab {
          animation: none;
          transition: none;
        }
      }
    `,
  ],
})
export class PoliciesPageComponent implements OnInit {
  protected readonly state = inject(PolicyStateService);
  private readonly toast = inject(ToastService);

  /** Route-supplied view configuration — see app.routes.ts. */
  readonly title = input('Policy Dashboard');
  readonly subtitle = input('Monitor policy portfolio and operational activity');
  readonly showOverview = input(true);
  readonly showTable = input(true);
  readonly seedFilter = input<Partial<PolicyFilter> | null>(null);

  /**
   * Filter keys this route pins. /flagged seeds `flagged: true` and re-applies it
   * on every navigation, so anything offering to clear it did nothing — the
   * toolbar hides those affordances rather than leaving them dead.
   */
  protected readonly lockedKeys = computed(
    () => Object.keys(this.seedFilter() ?? {}) as (keyof PolicyFilter)[]
  );

  protected readonly assistantOpen = signal(false);
  protected readonly flagDialogOpen = signal(false);
  protected readonly pendingFlagIds = signal<string[]>([]);

  protected readonly isEmpty = computed(
    () => state_isEmpty(this.state.status(), this.state.items().length)
  );

  ngOnInit(): void {
    this.state.init();
    const seed = this.seedFilter();
    if (seed) this.state.patchFilter(seed);
  }

  protected relativeTime(date: Date): string {
    return formatRelativeTime(date);
  }

  protected refresh(): void {
    this.state.refetch();
  }

  protected clearOne(key: keyof PolicyFilter): void {
    this.state.clearFilter(key);
  }

  protected applyKpiFilter(patch: Record<string, string>): void {
    const mapped: Partial<PolicyFilter> = {};
    if (patch['status']) mapped.status = patch['status'];
    if (patch['flagged']) mapped.flagged = patch['flagged'] === 'true';
    this.state.patchFilter(mapped);
  }

  protected openBulkFlag(): void {
    this.pendingFlagIds.set([...this.state.selectedIds()]);
    this.flagDialogOpen.set(true);
  }

  protected openSingleFlag(policy: Policy): void {
    this.pendingFlagIds.set([policy.id]);
    this.flagDialogOpen.set(true);
  }

  protected confirmFlag(): void {
    this.state.flagPolicies(this.pendingFlagIds());
    this.flagDialogOpen.set(false);
  }

  /** Client-side CSV of the current page — the API has no export endpoint, so this
   *  exports exactly the rows on screen rather than implying a full-portfolio export. */
  protected exportCsv(): void {
    const rows = this.state.items();
    if (rows.length === 0) {
      this.toast.info('Nothing to export');
      return;
    }

    const headers = [
      'Policy Number',
      'Policyholder',
      'Status',
      'Line of Business',
      'Region',
      'Premium',
      'Currency',
      'Effective Date',
      'Expiry Date',
      'Underwriter',
      'Flagged',
    ];
    const escape = (v: string | number | boolean) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [
      headers.join(','),
      ...rows.map((p) =>
        [
          p.policyNumber,
          p.policyholderName,
          p.status,
          p.lineOfBusiness,
          p.region,
          p.premiumAmount,
          p.currency,
          p.effectiveDate,
          p.expiryDate,
          p.underwriter,
          p.flaggedForReview,
        ]
          .map(escape)
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `policies-page-${this.state.filter().page}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    this.toast.success(`Exported ${rows.length} policies`);
  }

  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDate = formatDate;
}

function state_isEmpty(status: string, count: number): boolean {
  return status === 'success' && count === 0;
}
