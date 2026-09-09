import {
  Injectable,
  Injector,
  computed,
  effect,
  inject,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { ActivatedRoute, NavigationEnd, Params, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, switchMap } from 'rxjs/operators';
import { Policy } from '../../core/models/policy.model';
import {
  DEFAULT_FILTER,
  PolicyFilter,
  activeFilterCount,
} from '../../core/models/policy-filter.model';
import { PolicySummary } from '../../core/models/policy-summary.model';
import { PolicyService } from '../../core/services/policy.service';
import { ToastService } from '../../core/services/toast.service';

export type RequestStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * The single data layer for the policy workspace. Components read signals and call
 * intent methods — no component issues its own HTTP request.
 *
 * The filter signal is the source of truth; an effect mirrors it into the URL and
 * refetches, which is what makes refresh, deep-linking and back/forward work without
 * any component touching the router.
 */
@Injectable()
export class PolicyStateService {
  private readonly api = inject(PolicyService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);

  // --- list state ---
  private readonly _filter = signal<PolicyFilter>({ ...DEFAULT_FILTER });
  private readonly _status = signal<RequestStatus>('idle');
  private readonly _items = signal<Policy[]>([]);
  private readonly _totalCount = signal(0);
  private readonly _totalPages = signal(0);
  private readonly _summary = signal<PolicySummary | null>(null);
  private readonly _lastUpdated = signal<Date | null>(null);

  // --- selection (client-only; never round-trips to the server) ---
  private readonly _selectedIds = signal<ReadonlySet<string>>(new Set());

  // --- detail drawer ---
  private readonly _detail = signal<Policy | null>(null);
  private readonly _detailLoading = signal(false);
  private readonly _detailId = signal<string | null>(null);

  // --- mutation ---
  private readonly _flagInFlight = signal(false);

  readonly filter = this._filter.asReadonly();
  readonly status = this._status.asReadonly();
  readonly items = this._items.asReadonly();
  readonly totalCount = this._totalCount.asReadonly();
  readonly totalPages = this._totalPages.asReadonly();
  readonly summary = this._summary.asReadonly();
  readonly lastUpdated = this._lastUpdated.asReadonly();
  readonly selectedIds = this._selectedIds.asReadonly();
  readonly detail = this._detail.asReadonly();
  readonly detailLoading = this._detailLoading.asReadonly();
  readonly detailId = this._detailId.asReadonly();
  readonly flagInFlight = this._flagInFlight.asReadonly();

  readonly activeFilters = computed(() => activeFilterCount(this._filter()));
  readonly selectedCount = computed(() => this._selectedIds().size);
  readonly hasSelection = computed(() => this._selectedIds().size > 0);
  readonly isFirstLoad = computed(() => this._status() === 'loading' && this._items().length === 0);

  /** Indices of the current page within the overall result set, for "Showing X–Y of Z". */
  readonly range = computed(() => {
    const { page, size } = this._filter();
    const total = this._totalCount();
    if (total === 0) return { from: 0, to: 0, total: 0 };
    const from = (page - 1) * size + 1;
    return { from, to: Math.min(from + size - 1, total), total };
  });

  readonly allOnPageSelected = computed(() => {
    const items = this._items();
    if (items.length === 0) return false;
    const selected = this._selectedIds();
    return items.every((p) => selected.has(p.id));
  });

  readonly someOnPageSelected = computed(() => {
    const selected = this._selectedIds();
    return this._items().some((p) => selected.has(p.id)) && !this.allOnPageSelected();
  });

  private initialised = false;

  /** Called once by the shell. Seeds the filter from the URL, then keeps the two in sync. */
  init(): void {
    if (this.initialised) return;
    this.initialised = true;

    this._filter.set(this.readFilterFromUrl());

    runInInjectionContext(this.injector, () => {
      // Re-read from URL on every navigation end to handle component reuse cleanly
      this.router.events.subscribe((event) => {
        if (event instanceof NavigationEnd) {
          // Check if we are still the active route for this component
          if (this.route.snapshot.routeConfig) {
             const fromUrl = this.readFilterFromUrl();
             // Apply seed filter if it exists in route data
             const seed = this.route.snapshot.data['seedFilter'];
             this._filter.set({ ...fromUrl, ...(seed || {}) });
          }
        }
      });

      // allowSignalWrites: `fetch()` sets the status/result signals, and Angular 18
      // throws NG0600 on a signal write inside an effect unless it is opted into.
      // (The flag became the default in v19 and no longer exists there.) Without it
      // the initial load threw and every page stayed empty until a manual refresh.
      effect(
        () => {
          const filter = this._filter();
          this.writeFilterToUrl(filter);
          this.fetch(filter);
        },
        { allowSignalWrites: true }
      );
    });
  }

  /** Merge a partial change. Any change other than paging resets to page 1, since the
   *  old page number is meaningless against a different result set. */
  patchFilter(patch: Partial<PolicyFilter>): void {
    this._filter.update((current) => {
      const isPagingOnly = Object.keys(patch).every((k) => k === 'page' || k === 'size');
      return { ...current, ...patch, page: isPagingOnly ? (patch.page ?? current.page) : 1 };
    });
  }

  setPage(page: number): void {
    this._filter.update((f) => ({ ...f, page }));
  }

  setPageSize(size: number): void {
    this._filter.update((f) => ({ ...f, size, page: 1 }));
  }

  /** Toggles asc/desc when re-sorting the same column, otherwise starts ascending. */
  toggleSort(field: string): void {
    this._filter.update((f) => {
      const [currentField, currentDir] = f.sort.split(',');
      const dir = currentField === field && currentDir !== 'desc' ? 'desc' : 'asc';
      return { ...f, sort: `${field},${dir}`, page: 1 };
    });
  }

  clearFilters(): void {
    this._filter.update((f) => ({
      ...DEFAULT_FILTER,
      size: f.size,
      sort: f.sort,
    }));
  }

  clearFilter(key: keyof PolicyFilter): void {
    this.patchFilter({ [key]: null } as Partial<PolicyFilter>);
  }

  refetch(): void {
    this.api.invalidateAll();
    this.fetch(this._filter());
  }

  // --- selection ---

  toggleRow(id: string): void {
    this._selectedIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  toggleAllOnPage(): void {
    const items = this._items();
    const allSelected = this.allOnPageSelected();
    this._selectedIds.update((set) => {
      const next = new Set(set);
      for (const p of items) {
        if (allSelected) next.delete(p.id);
        else next.add(p.id);
      }
      return next;
    });
  }

  clearSelection(): void {
    this._selectedIds.set(new Set());
  }

  // --- detail drawer ---

  openDetail(policy: Policy): void {
    // Seed from the row we already have so the drawer paints instantly, then refresh
    // from the API for the authoritative record.
    this._detailId.set(policy.id);
    this._detail.set(policy);
    this._detailLoading.set(true);

    this.api
      .getById(policy.id)
      .pipe(finalize(() => this._detailLoading.set(false)))
      .subscribe({
        next: (full) => {
          if (this._detailId() === policy.id) this._detail.set(full);
        },
        error: () => this.toast.error('Unable to load policy details'),
      });
  }

  closeDetail(): void {
    this._detailId.set(null);
    this._detail.set(null);
    this._detailLoading.set(false);
  }

  // --- mutations ---
  
  setFlagInFlight(inFlight: boolean): void {
    this._flagInFlight.set(inFlight);
  }

  flagPolicies(ids: string[]): void {
    if (ids.length === 0) return;
    this._flagInFlight.set(true);

    this.api
      .flagPolicies(ids)
      .pipe(
        // Refetch on the same subscription so the table can never show stale
        // flag state after a successful mutation.
        switchMap((res) =>
          forkJoin({
            page: this.api.getPolicies(this._filter()),
            summary: this.api.getSummary(this._filter()),
          }).pipe(switchMap((data) => of({ res, data })))
        ),
        finalize(() => this._flagInFlight.set(false))
      )
      .subscribe({
        next: ({ res, data }) => {
          this._items.set(data.page.items);
          this._totalCount.set(data.page.totalCount);
          this._totalPages.set(data.page.totalPages);
          this._summary.set(data.summary);
          this._lastUpdated.set(new Date());
          this.clearSelection();

          const n = res.flaggedCount;
          this.toast.success(
            n === 1 ? '1 policy flagged successfully' : `${n} policies flagged successfully`
          );

          // Keep an open drawer in sync with the row it is showing.
          const openId = this._detailId();
          if (openId && res.flaggedPolicyIds.includes(openId)) {
            const updated = data.page.items.find((p) => p.id === openId);
            if (updated) this._detail.set(updated);
            else this._detail.update((p) => (p ? { ...p, flaggedForReview: true } : p));
          }
        },
        error: () => this.toast.error('Unable to update policies'),
      });
  }

  // --- internals ---

  private fetch(filter: PolicyFilter): void {
    this._status.set('loading');

    forkJoin({
      page: this.api.getPolicies(filter),
      summary: this.api.getSummary(filter),
    })
      .pipe(catchError(() => of(null)))
      .subscribe((data) => {
        if (!data) {
          this._status.set('error');
          return;
        }
        this._items.set(data.page.items);
        this._totalCount.set(data.page.totalCount);
        this._totalPages.set(data.page.totalPages);
        this._summary.set(data.summary);
        this._lastUpdated.set(new Date());
        this._status.set('success');
      });
  }

  private readFilterFromUrl(): PolicyFilter {
    const q = this.route.snapshot.queryParamMap;
    const num = (key: string, fallback: number) => {
      const parsed = Number(q.get(key));
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    };
    const flagged = q.get('flagged');

    return {
      page: num('page', DEFAULT_FILTER.page),
      size: num('size', DEFAULT_FILTER.size),
      sort: q.get('sort') ?? DEFAULT_FILTER.sort,
      status: q.get('status'),
      lineOfBusiness: q.get('lineOfBusiness'),
      region: q.get('region'),
      effectiveDateFrom: q.get('effectiveDateFrom'),
      effectiveDateTo: q.get('effectiveDateTo'),
      search: q.get('search'),
      flagged: flagged === null ? null : flagged === 'true',
    };
  }

  private writeFilterToUrl(filter: PolicyFilter): void {
    const params: Params = {};
    for (const [key, value] of Object.entries(filter)) {
      // Defaults stay out of the URL so a pristine view has a clean address.
      if (value === null || value === '') continue;
      if (key === 'page' && value === 1) continue;
      if (key === 'size' && value === DEFAULT_FILTER.size) continue;
      if (key === 'sort' && value === DEFAULT_FILTER.sort) continue;
      params[key] = value;
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      replaceUrl: true,
    });
  }
}
