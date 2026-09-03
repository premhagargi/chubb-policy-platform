import { Component, OnInit, inject, signal } from '@angular/core';
import { PolicyStateService } from './policy-state.service';
import { PolicyService } from '../../core/services/policy.service';
import { PolicyFiltersComponent, FilterChange } from './policy-filters/policy-filters.component';
import { PolicyTableComponent } from './policy-table/policy-table.component';
import { PolicySummaryCardsComponent } from './policy-summary-cards/policy-summary-cards.component';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner/error-banner.component';
import { ThemeToggleComponent } from '../../shared/components/theme-toggle/theme-toggle.component';

/** Smart/container: owns query state (via PolicyStateService) and the page-local,
 * client-only row-selection state (never persisted, never touches the server-state
 * service). Wires dumb child components together and handles the bulk-flag action. */
@Component({
  selector: 'app-policies-page',
  standalone: true,
  imports: [
    PolicyFiltersComponent,
    PolicyTableComponent,
    PolicySummaryCardsComponent,
    LoadingSpinnerComponent,
    EmptyStateComponent,
    ErrorBannerComponent,
    ThemeToggleComponent
  ],
  templateUrl: './policies-page.component.html',
  styleUrl: './policies-page.component.scss'
})
export class PoliciesPageComponent implements OnInit {
  protected readonly state = inject(PolicyStateService);
  private readonly policyService = inject(PolicyService);

  protected readonly selectedIds = signal<Set<string>>(new Set());
  protected readonly flagInFlight = signal(false);

  ngOnInit(): void {
    this.state.initFromUrl();
  }

  onFilterChange(change: Partial<FilterChange>): void {
    this.state.updateFilter(change);
    this.selectedIds.set(new Set());
  }

  onSortChange(sort: string): void {
    this.state.updateFilter({ sort });
  }

  onPageChange(page: number): void {
    this.state.filter.update((f) => ({ ...f, page }));
  }

  onSelectionChange(ids: Set<string>): void {
    this.selectedIds.set(ids);
  }

  flagSelected(): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;

    this.flagInFlight.set(true);
    this.policyService.flagPolicies(ids).subscribe({
      next: () => {
        this.flagInFlight.set(false);
        this.selectedIds.set(new Set());
        this.state.refetch();
      },
      error: () => this.flagInFlight.set(false)
    });
  }
}
