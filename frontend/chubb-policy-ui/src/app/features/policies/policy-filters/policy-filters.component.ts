import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LINES_OF_BUSINESS, POLICY_STATUSES, REGIONS } from '../../../core/models/policy.model';
import { PolicyFilter } from '../../../core/models/policy-filter.model';

export interface FilterChange {
  status: string | null;
  lineOfBusiness: string | null;
  region: string | null;
  effectiveDateFrom: string | null;
  effectiveDateTo: string | null;
  search: string | null;
}

/** Dumb/presentational: renders controls from the current filter and emits changes.
 * Owns no server state and makes no HTTP calls itself. */
@Component({
  selector: 'app-policy-filters',
  standalone: true,
  imports: [],
  templateUrl: './policy-filters.component.html',
  styleUrl: './policy-filters.component.scss'
})
export class PolicyFiltersComponent {
  @Input({ required: true }) filter!: PolicyFilter;
  @Output() readonly filterChange = new EventEmitter<Partial<FilterChange>>();

  protected readonly statuses = POLICY_STATUSES;
  protected readonly linesOfBusiness = LINES_OF_BUSINESS;
  protected readonly regions = REGIONS;

  private searchDebounce?: ReturnType<typeof setTimeout>;

  onSelectChange(field: keyof FilterChange, value: string): void {
    this.filterChange.emit({ [field]: value || null } as Partial<FilterChange>);
  }

  onSearchInput(value: string): void {
    clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.filterChange.emit({ search: value || null }), 300);
  }

  clearAll(): void {
    this.filterChange.emit({
      status: null,
      lineOfBusiness: null,
      region: null,
      effectiveDateFrom: null,
      effectiveDateTo: null,
      search: null
    });
  }
}
