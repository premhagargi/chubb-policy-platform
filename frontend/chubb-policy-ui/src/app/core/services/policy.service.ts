import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Policy } from '../models/policy.model';
import { PagedResult } from '../models/paged-result.model';
import { PolicyFilter } from '../models/policy-filter.model';
import { PolicySummary } from '../models/policy-summary.model';

/** Mirrors FlagPoliciesResult on the server. */
export interface FlagPoliciesResponse {
  flaggedPolicyIds: string[];
  flaggedCount: number;
}

const BASE_URL = '/api/v1/policies';

/** How long a cached response is considered fresh (milliseconds). */
const LIST_TTL_MS = 30_000;
const SUMMARY_TTL_MS = 60_000;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/** Thin HttpClient wrapper matching the OpenAPI contract exactly. Owns all server-state
 * I/O — PolicyStateService is the only consumer, so server-fetched data never gets
 * hand-mutated outside this boundary.
 *
 * Includes a short-lived client-side cache so repeat requests with identical filters
 * (e.g. navigating back to a page you just left) are served instantly without a
 * network round-trip. Any mutation (flag) invalidates the entire cache. */
@Injectable({ providedIn: 'root' })
export class PolicyService {
  private readonly http = inject(HttpClient);

  /** In-memory cache keyed by the full request URL (including query params). */
  private readonly listCache = new Map<string, CacheEntry<PagedResult<Policy>>>();
  private readonly summaryCache = new Map<string, CacheEntry<PolicySummary>>();

  getPolicies(filter: PolicyFilter): Observable<PagedResult<Policy>> {
    const key = this.buildCacheKey(BASE_URL, this.toHttpParams(filter, true));
    const cached = this.getIfFresh(this.listCache, key, LIST_TTL_MS);
    if (cached) return of(cached);

    return this.http
      .get<PagedResult<Policy>>(BASE_URL, {
        params: this.toHttpParams(filter, true),
      })
      .pipe(tap((data) => this.listCache.set(key, { data, timestamp: Date.now() })));
  }

  getSummary(filter: PolicyFilter): Observable<PolicySummary> {
    const key = this.buildCacheKey(`${BASE_URL}/summary`, this.toHttpParams(filter, false));
    const cached = this.getIfFresh(this.summaryCache, key, SUMMARY_TTL_MS);
    if (cached) return of(cached);

    return this.http
      .get<PolicySummary>(`${BASE_URL}/summary`, {
        params: this.toHttpParams(filter, false),
      })
      .pipe(tap((data) => this.summaryCache.set(key, { data, timestamp: Date.now() })));
  }

  getById(id: string): Observable<Policy> {
    return this.http.get<Policy>(`${BASE_URL}/${id}`);
  }

  flagPolicies(policyIds: string[]): Observable<FlagPoliciesResponse> {
    // Invalidate all cached data — flag mutations change summary aggregations
    // and potentially every filtered list.
    this.invalidateAll();
    return this.http.patch<FlagPoliciesResponse>(`${BASE_URL}/flag`, { policyIds });
  }

  /** Evict all cached responses. Called after mutations and available to consumers
   *  that need a guaranteed-fresh fetch (e.g. manual refresh). */
  invalidateAll(): void {
    this.listCache.clear();
    this.summaryCache.clear();
  }

  // --- internals ---

  private getIfFresh<T>(cache: Map<string, CacheEntry<T>>, key: string, ttlMs: number): T | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > ttlMs) {
      cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private buildCacheKey(url: string, params: HttpParams): string {
    const qs = params.toString();
    return qs ? `${url}?${qs}` : url;
  }

  private toHttpParams(filter: PolicyFilter, includePaging: boolean): HttpParams {
    let params = new HttpParams();

    if (includePaging) {
      params = params.set('page', filter.page).set('size', filter.size).set('sort', filter.sort);
    }
    if (filter.status) params = params.set('status', filter.status);
    if (filter.lineOfBusiness) params = params.set('lineOfBusiness', filter.lineOfBusiness);
    if (filter.region) params = params.set('region', filter.region);
    if (filter.effectiveDateFrom) params = params.set('effectiveDateFrom', filter.effectiveDateFrom);
    if (filter.effectiveDateTo) params = params.set('effectiveDateTo', filter.effectiveDateTo);
    if (filter.search) params = params.set('search', filter.search);
    // Explicit null check — `false` is a meaningful value here, unlike the others.
    if (filter.flagged !== null) params = params.set('flagged', filter.flagged);

    return params;
  }
}
