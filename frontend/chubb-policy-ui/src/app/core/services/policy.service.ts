import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Policy } from '../models/policy.model';
import { PagedResult } from '../models/paged-result.model';
import { PolicyFilter } from '../models/policy-filter.model';
import { PolicySummary } from '../models/policy-summary.model';

export interface FlagPoliciesResponse {
  flaggedPolicyIds: string[];
  flaggedCount: number;
}

const BASE_URL = '/api/v1/policies';

/** Thin HttpClient wrapper matching the OpenAPI contract exactly. Owns all server-state
 * I/O — PolicyStateService is the only consumer, so server-fetched data never gets
 * hand-mutated outside this boundary. */
@Injectable({ providedIn: 'root' })
export class PolicyService {
  constructor(private readonly http: HttpClient) {}

  getPolicies(filter: PolicyFilter): Observable<PagedResult<Policy>> {
    return this.http.get<PagedResult<Policy>>(BASE_URL, { params: this.toHttpParams(filter, true) });
  }

  getSummary(filter: PolicyFilter): Observable<PolicySummary> {
    return this.http.get<PolicySummary>(`${BASE_URL}/summary`, { params: this.toHttpParams(filter, false) });
  }

  getById(id: string): Observable<Policy> {
    return this.http.get<Policy>(`${BASE_URL}/${id}`);
  }

  flagPolicies(policyIds: string[]): Observable<FlagPoliciesResponse> {
    return this.http.patch<FlagPoliciesResponse>(`${BASE_URL}/flag`, { policyIds });
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

    return params;
  }
}
