import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { PolicyStateService } from './policy-state.service';

/**
 * Regression cover for initial load.
 *
 * `init()` fetches from inside an `effect()`, and Angular 18 throws NG0600 on a
 * signal write inside an effect unless `allowSignalWrites` is set. When that
 * option was missing, the effect threw, no request was ever issued, and every
 * page rendered empty until the user pressed Refresh — which calls `fetch()`
 * directly and so was unaffected. Nothing covered the load path, so it shipped.
 */
describe('PolicyStateService initial load', () => {
  let service: PolicyStateService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        PolicyStateService,
      ],
    });

    service = TestBed.inject(PolicyStateService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function flushInitialLoad(totalCount = 1): void {
    const list = httpMock.expectOne((r) => r.url === '/api/v1/policies');
    const summary = httpMock.expectOne((r) => r.url === '/api/v1/policies/summary');

    list.flush({
      items: [
        {
          id: 'a1',
          policyNumber: 'PCL-100001',
          policyholderName: 'Acme',
          lineOfBusiness: 'Property',
          status: 'Active',
          premiumAmount: 1000,
          currency: 'SGD',
          effectiveDate: '2026-01-01',
          expiryDate: '2027-01-01',
          region: 'Singapore',
          underwriter: 'J. Tan',
          flaggedForReview: false,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ],
      page: 1,
      size: 20,
      totalCount,
      totalPages: 1,
    });

    summary.flush({
      countsByStatus: { Active: totalCount },
      premiumByLineOfBusiness: { Property: 1000 },
      expiringSoonCount: 0,
      flaggedCount: 0,
      totalCount,
      countsByRegion: { Singapore: totalCount },
    });
  }

  it('fetches policies and summary on init, without a manual refresh', () => {
    service.init();
    TestBed.flushEffects();

    expect(() => flushInitialLoad()).not.toThrow();
    expect(service.items().length).toBe(1);
    expect(service.status()).toBe('success');
  });

  it('populates the summary on init', () => {
    service.init();
    TestBed.flushEffects();
    flushInitialLoad(7);

    expect(service.summary()?.totalCount).toBe(7);
    expect(service.totalCount()).toBe(7);
  });

  it('refetches when the filter changes', () => {
    service.init();
    TestBed.flushEffects();
    flushInitialLoad();

    service.patchFilter({ region: 'Japan' });
    TestBed.flushEffects();

    const list = httpMock.expectOne(
      (r) => r.url === '/api/v1/policies' && r.params.get('region') === 'Japan'
    );
    const summary = httpMock.expectOne(
      (r) => r.url === '/api/v1/policies/summary' && r.params.get('region') === 'Japan'
    );

    expect(list.request.method).toBe('GET');
    list.flush({ items: [], page: 1, size: 20, totalCount: 0, totalPages: 0 });
    summary.flush({
      countsByStatus: {},
      premiumByLineOfBusiness: {},
      expiringSoonCount: 0,
      flaggedCount: 0,
      totalCount: 0,
      countsByRegion: {},
    });
  });

  it('is idempotent - a second init does not double-fetch', () => {
    service.init();
    service.init();
    TestBed.flushEffects();

    flushInitialLoad();
  });
});
