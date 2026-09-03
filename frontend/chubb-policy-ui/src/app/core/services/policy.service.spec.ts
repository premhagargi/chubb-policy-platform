import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { PolicyService } from './policy.service';
import { DEFAULT_FILTER } from '../models/policy-filter.model';

describe('PolicyService', () => {
  let service: PolicyService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(PolicyService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getPolicies sends paging/sort params and omits unset filters', () => {
    service.getPolicies(DEFAULT_FILTER).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === '/api/v1/policies' && r.params.get('page') === '1' && r.params.get('size') === '20'
    );
    expect(req.request.params.has('status')).toBe(false);
    req.flush({ items: [], page: 1, size: 20, totalCount: 0, totalPages: 0 });
  });

  it('getPolicies includes set filters as query params', () => {
    service.getPolicies({ ...DEFAULT_FILTER, status: 'Active', search: 'PCL-1' }).subscribe();

    const req = httpMock.expectOne(
      (r) => r.params.get('status') === 'Active' && r.params.get('search') === 'PCL-1'
    );
    req.flush({ items: [], page: 1, size: 20, totalCount: 0, totalPages: 0 });
  });

  it('getSummary omits paging/sort params entirely', () => {
    service.getSummary(DEFAULT_FILTER).subscribe();

    const req = httpMock.expectOne('/api/v1/policies/summary');
    expect(req.request.params.has('page')).toBe(false);
    expect(req.request.params.has('sort')).toBe(false);
    req.flush({ countsByStatus: {}, premiumByLineOfBusiness: {}, expiringSoonCount: 0 });
  });

  it('flagPolicies PATCHes the flag endpoint with the given ids', () => {
    service.flagPolicies(['id-1', 'id-2']).subscribe();

    const req = httpMock.expectOne('/api/v1/policies/flag');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ policyIds: ['id-1', 'id-2'] });
    req.flush({ flaggedPolicyIds: ['id-1', 'id-2'], flaggedCount: 2 });
  });
});
