import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Policy } from '../../../core/models/policy.model';
import { SortableField } from '../../../core/models/policy-filter.model';

interface Column {
  field: SortableField;
  label: string;
}

/** Dumb/presentational: renders a page of policies, sortable headers, pagination, and
 * row selection. Emits events for every interaction; owns no server state. */
@Component({
  selector: 'app-policy-table',
  standalone: true,
  templateUrl: './policy-table.component.html',
  styleUrl: './policy-table.component.scss'
})
export class PolicyTableComponent {
  @Input({ required: true }) items: Policy[] = [];
  @Input({ required: true }) sort = 'createdAt,desc';
  @Input({ required: true }) page = 1;
  @Input({ required: true }) totalPages = 1;
  @Input({ required: true }) selectedIds: ReadonlySet<string> = new Set();

  @Output() readonly sortChange = new EventEmitter<string>();
  @Output() readonly pageChange = new EventEmitter<number>();
  @Output() readonly selectionChange = new EventEmitter<Set<string>>();

  protected readonly columns: Column[] = [
    { field: 'policyNumber', label: 'Policy #' },
    { field: 'policyholderName', label: 'Policyholder' },
    { field: 'lineOfBusiness', label: 'Line of business' },
    { field: 'status', label: 'Status' },
    { field: 'premiumAmount', label: 'Premium' },
    { field: 'effectiveDate', label: 'Effective' },
    { field: 'expiryDate', label: 'Expiry' },
    { field: 'region', label: 'Region' }
  ];

  get sortField(): string {
    return this.sort.split(',')[0];
  }

  get sortDescending(): boolean {
    return this.sort.split(',')[1] === 'desc';
  }

  ariaSortFor(field: SortableField): 'ascending' | 'descending' | 'none' {
    if (this.sortField !== field) return 'none';
    return this.sortDescending ? 'descending' : 'ascending';
  }

  onHeaderActivate(field: SortableField): void {
    const nextDescending = this.sortField === field ? !this.sortDescending : true;
    this.sortChange.emit(`${field},${nextDescending ? 'desc' : 'asc'}`);
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  get allOnPageSelected(): boolean {
    return this.items.length > 0 && this.items.every((p) => this.selectedIds.has(p.id));
  }

  toggleRow(id: string, checked: boolean): void {
    const next = new Set(this.selectedIds);
    checked ? next.add(id) : next.delete(id);
    this.selectionChange.emit(next);
  }

  toggleAllOnPage(checked: boolean): void {
    const next = new Set(this.selectedIds);
    for (const item of this.items) {
      checked ? next.add(item.id) : next.delete(item.id);
    }
    this.selectionChange.emit(next);
  }

  formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  }
}
