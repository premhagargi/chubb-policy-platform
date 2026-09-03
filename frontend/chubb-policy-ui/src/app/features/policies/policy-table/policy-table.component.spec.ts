import { TestBed } from '@angular/core/testing';
import { PolicyTableComponent } from './policy-table.component';
import { Policy } from '../../../core/models/policy.model';

function makePolicy(overrides: Partial<Policy> = {}): Policy {
  return {
    id: 'id-1',
    policyNumber: 'PCL-000001',
    policyholderName: 'Jane Tan',
    lineOfBusiness: 'Property',
    status: 'Active',
    premiumAmount: 10000,
    currency: 'SGD',
    effectiveDate: '2026-01-01',
    expiryDate: '2027-01-01',
    region: 'Singapore',
    underwriter: 'John Underwriter',
    flaggedForReview: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides
  };
}

describe('PolicyTableComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PolicyTableComponent] }).compileComponents();
  });

  function setup(items: Policy[]) {
    const fixture = TestBed.createComponent(PolicyTableComponent);
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('sort', 'createdAt,desc');
    fixture.componentRef.setInput('page', 1);
    fixture.componentRef.setInput('totalPages', 3);
    fixture.componentRef.setInput('selectedIds', new Set<string>());
    fixture.detectChanges();
    return fixture;
  }

  it('renders one row per item', () => {
    const fixture = setup([makePolicy({ id: 'a' }), makePolicy({ id: 'b', policyNumber: 'PCL-000002' })]);
    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
  });

  it('emits sortChange with toggled direction when a header is activated', () => {
    const fixture = setup([makePolicy()]);
    const component = fixture.componentInstance;
    const emitted: string[] = [];
    component.sortChange.subscribe((value: string) => emitted.push(value));

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('thead .sort-btn');
    button.click();

    expect(emitted[0]).toBe('policyNumber,desc');
  });

  it('sets aria-sort on the active column header', () => {
    const fixture = TestBed.createComponent(PolicyTableComponent);
    fixture.componentRef.setInput('items', [makePolicy()]);
    fixture.componentRef.setInput('sort', 'premiumAmount,asc');
    fixture.componentRef.setInput('page', 1);
    fixture.componentRef.setInput('totalPages', 1);
    fixture.componentRef.setInput('selectedIds', new Set<string>());
    fixture.detectChanges();

    const headers: NodeListOf<HTMLTableCellElement> = fixture.nativeElement.querySelectorAll('thead th[scope="col"]');
    const premiumHeader = Array.from(headers).find((h) => h.textContent?.includes('Premium'));
    expect(premiumHeader?.getAttribute('aria-sort')).toBe('ascending');
  });

  it('emits selectionChange when a row checkbox is toggled', () => {
    const fixture = setup([makePolicy({ id: 'row-1' })]);
    const component = fixture.componentInstance;
    let lastSelection: Set<string> | undefined;
    component.selectionChange.subscribe((s: Set<string>) => (lastSelection = s));

    const checkbox: HTMLInputElement = fixture.nativeElement.querySelector('tbody input[type="checkbox"]');
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));

    expect(lastSelection?.has('row-1')).toBe(true);
  });
});
