import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Policy } from '../../../core/models/policy.model';
import { IconComponent } from '../../../shared/ui/icon.component';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge.component';
import { formatCurrency, formatDate } from '../../../shared/utils/format';

interface Column {
  key: string;
  label: string;
  sortable: boolean;
  /** Right-align numeric columns so digits line up down the column. */
  numeric?: boolean;
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
}

const COLUMNS: Column[] = [
  { key: 'policyNumber', label: 'Policy', sortable: true },
  { key: 'policyholderName', label: 'Policyholder', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'lineOfBusiness', label: 'Line of Business', sortable: true, hideBelow: 'md' },
  { key: 'region', label: 'Region', sortable: true, hideBelow: 'lg' },
  { key: 'premiumAmount', label: 'Premium', sortable: true, numeric: true },
  { key: 'effectiveDate', label: 'Effective', sortable: true, hideBelow: 'xl' },
  { key: 'expiryDate', label: 'Expiry', sortable: true, hideBelow: 'lg' },
  { key: 'underwriter', label: 'Underwriter', sortable: true, hideBelow: 'xl' },
];

@Component({
  selector: 'app-policy-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, StatusBadgeComponent],
  template: `
    <div class="overflow-x-auto">
      <table class="w-full border-collapse text-[13px]">
        <caption class="sr-only">
          Policies, sortable. {{ rows().length }} rows on this page.
        </caption>
        <thead>
          <tr style="border-bottom: 1px solid var(--border);">
            <th scope="col" class="w-10 px-3 py-2.5 text-left">
              <input
                type="checkbox"
                class="h-3.5 w-3.5 cursor-pointer rounded accent-[var(--brand)] align-middle"
                [checked]="allSelected()"
                [indeterminate]="someSelected()"
                (change)="toggleAll.emit()"
                [attr.aria-label]="allSelected() ? 'Deselect all on page' : 'Select all on page'"
              />
            </th>
            @for (col of columns; track col.key) {
              <th
                scope="col"
                class="whitespace-nowrap px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide"
                [class]="headerClass(col)"
                style="color: var(--text-muted);"
                [attr.aria-sort]="ariaSort(col.key)"
              >
                @if (col.sortable) {
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded transition-colors hover:text-[var(--text)]"
                    [class.flex-row-reverse]="col.numeric"
                    (click)="sortBy.emit(col.key)"
                  >
                    {{ col.label }}
                    <span
                      class="transition-opacity"
                      [style.opacity]="sortField() === col.key ? '1' : '0'"
                      [style.color]="'var(--brand)'"
                      aria-hidden="true"
                    >
                      <app-icon
                        [name]="sortDir() === 'desc' ? 'arrow-down' : 'arrow-up'"
                        [size]="12"
                      />
                    </span>
                  </button>
                } @else {
                  {{ col.label }}
                }
              </th>
            }
            <th scope="col" class="w-10 px-3 py-2.5"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>

        <tbody>
          @if (loading()) {
            @for (i of skeletonRows; track i) {
              <tr style="border-bottom: 1px solid var(--border);">
                <td class="px-3 py-3"><div class="skeleton h-3.5 w-3.5"></div></td>
                @for (col of columns; track col.key) {
                  <td class="px-3 py-3" [class]="headerClass(col)">
                    <div class="skeleton h-3.5" [style.width.%]="60 + ((i * 7) % 35)"></div>
                  </td>
                }
                <td class="px-3 py-3"></td>
              </tr>
            }
          } @else {
            @for (policy of rows(); track policy.id) {
              <tr
                class="cursor-pointer transition-colors hover:bg-[var(--surface-hover)]"
                [style.background]="
                  isSelected(policy.id) ? 'color-mix(in srgb, var(--brand) 4%, transparent)' : ''
                "
                style="border-bottom: 1px solid var(--border);"
                (click)="rowClick.emit(policy)"
                (keydown.enter)="rowClick.emit(policy)"
                (keydown.space)="$event.preventDefault(); rowClick.emit(policy)"
                tabindex="0"
                [attr.aria-selected]="isSelected(policy.id)"
              >
                <td class="px-3 py-2.5" (click)="$event.stopPropagation()">
                  <input
                    type="checkbox"
                    class="h-3.5 w-3.5 cursor-pointer rounded accent-[var(--brand)] align-middle"
                    [checked]="isSelected(policy.id)"
                    (change)="toggleRow.emit(policy.id)"
                    [attr.aria-label]="'Select policy ' + policy.policyNumber"
                  />
                </td>

                <td class="whitespace-nowrap px-3 py-2.5">
                  <div class="flex items-center gap-1.5">
                    @if (policy.flaggedForReview) {
                      <span
                        class="shrink-0"
                        style="color: var(--flag);"
                        title="Flagged for review"
                        aria-label="Flagged for review"
                      >
                        <app-icon name="flag" [size]="13" />
                      </span>
                    }
                    <span class="tabular font-medium" style="color: var(--text);">{{
                      policy.policyNumber
                    }}</span>
                  </div>
                </td>

                <td class="max-w-[200px] truncate px-3 py-2.5" style="color: var(--text);">
                  {{ policy.policyholderName }}
                </td>

                <td class="px-3 py-2.5">
                  <app-status-badge [status]="policy.status" />
                </td>

                <td class="whitespace-nowrap px-3 py-2.5 max-md:hidden" style="color: var(--text-muted);">
                  {{ policy.lineOfBusiness }}
                </td>

                <td class="whitespace-nowrap px-3 py-2.5 max-lg:hidden" style="color: var(--text-muted);">
                  {{ policy.region }}
                </td>

                <td class="tabular whitespace-nowrap px-3 py-2.5 text-right font-medium" style="color: var(--text);">
                  {{ formatCurrency(policy.premiumAmount, policy.currency) }}
                </td>

                <td class="tabular whitespace-nowrap px-3 py-2.5 max-xl:hidden" style="color: var(--text-muted);">
                  {{ formatDate(policy.effectiveDate) }}
                </td>

                <td class="tabular whitespace-nowrap px-3 py-2.5 max-lg:hidden" style="color: var(--text-muted);">
                  {{ formatDate(policy.expiryDate) }}
                </td>

                <td class="max-w-[160px] truncate px-3 py-2.5 max-xl:hidden" style="color: var(--text-muted);">
                  {{ policy.underwriter }}
                </td>

                <td class="px-3 py-2.5 text-right">
                  <span style="color: var(--text-subtle);" aria-hidden="true">
                    <app-icon name="chevron-right" [size]="15" />
                  </span>
                </td>
              </tr>
            }
          }
        </tbody>
      </table>
    </div>
  `,
})
export class PolicyTableComponent {
  readonly rows = input<Policy[]>([]);
  readonly selectedIds = input<ReadonlySet<string>>(new Set());
  readonly sort = input('createdAt,desc');
  readonly loading = input(false);
  readonly allSelected = input(false);
  readonly someSelected = input(false);

  readonly sortBy = output<string>();
  readonly toggleRow = output<string>();
  readonly toggleAll = output<void>();
  readonly rowClick = output<Policy>();

  protected readonly columns = COLUMNS;
  protected readonly skeletonRows = Array.from({ length: 8 }, (_, i) => i);
  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDate = formatDate;

  protected readonly sortField = computed(() => this.sort().split(',')[0]);
  protected readonly sortDir = computed(() => this.sort().split(',')[1] ?? 'asc');

  protected isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  protected ariaSort(key: string): 'ascending' | 'descending' | 'none' {
    if (this.sortField() !== key) return 'none';
    return this.sortDir() === 'desc' ? 'descending' : 'ascending';
  }

  protected headerClass(col: Column): string {
    const classes: string[] = [];
    if (col.numeric) classes.push('text-right');
    else classes.push('text-left');
    if (col.hideBelow === 'md') classes.push('max-md:hidden');
    if (col.hideBelow === 'lg') classes.push('max-lg:hidden');
    if (col.hideBelow === 'xl') classes.push('max-xl:hidden');
    return classes.join(' ');
  }
}
