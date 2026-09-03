import { Injectable, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Policy } from '../../core/models/policy.model';
import { PolicySummary } from '../../core/models/policy-summary.model';
import { DEFAULT_FILTER, PolicyFilter } from '../../core/models/policy-filter.model';
import { PolicyService } from '../../core/services/policy.service';
import { ApiError } from '../../core/interceptors/error.interceptor';

export type RequestStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * Owns SERVER state only: the current filter/paging/sort query, the fetched page of
 * policies, the fetched summary, and the in-flight request status. Client-only state
 * (theme, row selection) lives elsewhere (ThemeService, component-local signals) and
 * never touches this service. The filter is the single source of truth and is kept in
 * sync with the URL's query params both ways, so the current view is always shareable.
 */
@Injectable({ providedIn: 'root' })
export class PolicyStateService {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly policyService = inject(PolicyService);

  readonly filter = signal<PolicyFilter>(DEFAULT_FILTER);
  readonly status = signal<RequestStatus>('idle');
  readonly items = signal<Policy[]>([]);
  readonly totalCount = signal(0);
  readonly totalPages = signal(0);
  readonly summary = signal<PolicySummary | null>(null);
  readonly error = signal<ApiError | null>(null);

  private initialized = false;

  /** Called once by the page container on init — reads the initial filter from the URL,
   * then reacts to every subsequent filter change by refetching. */
  initFromUrl(): void {
    if (this.initialized) return;
    this.initialized = true;

    const params = this.route.snapshot.queryParamMap;
    this.filter.set({
      page: Number(params.get('page') ?? DEFAULT_FILTER.page),
      size: Number(params.get('size') ?? DEFAULT_FILTER.size),
      sort: params.get('sort') ?? DEFAULT_FILTER.sort,
      status: params.get('status'),
      lineOfBusiness: params.get('lineOfBusiness'),
      region: params.get('region'),
      effectiveDateFrom: params.get('effectiveDateFrom'),
      effectiveDateTo: params.get('effectiveDateTo'),
      search: params.get('search')
    });

    effect(() => {
      const currentFilter = this.filter();
      this.syncUrl(currentFilter);
      this.fetch(currentFilter);
    });
  }

  /** Merge a partial filter change. Any change other than an explicit page navigation
   * resets to page 1 — changing a filter while sitting on page 4 of the old results
   * would otherwise silently show an out-of-range page. */
  updateFilter(partial: Partial<PolicyFilter>): void {
    const resetPage = !('page' in partial);
    this.filter.update((current) => ({
      ...current,
      ...partial,
      page: resetPage ? 1 : (partial.page ?? current.page)
    }));
  }

  refetch(): void {
    this.fetch(this.filter());
  }

  private fetch(filter: PolicyFilter): void {
    this.status.set('loading');
    this.error.set(null);

    forkJoin({
      page: this.policyService.getPolicies(filter),
      summary: this.policyService.getSummary(filter)
    }).subscribe({
      next: ({ page, summary }) => {
        this.items.set(page.items);
        this.totalCount.set(page.totalCount);
        this.totalPages.set(page.totalPages);
        this.summary.set(summary);
        this.status.set('success');
      },
      error: (err: ApiError) => {
        this.error.set(err);
        this.status.set('error');
      }
    });
  }

  private syncUrl(filter: PolicyFilter): void {
    const queryParams: Record<string, string | null> = {
      page: String(filter.page),
      size: String(filter.size),
      sort: filter.sort,
      status: filter.status,
      lineOfBusiness: filter.lineOfBusiness,
      region: filter.region,
      effectiveDateFrom: filter.effectiveDateFrom,
      effectiveDateTo: filter.effectiveDateTo,
      search: filter.search
    };

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: '',
      replaceUrl: true
    });
  }
}
