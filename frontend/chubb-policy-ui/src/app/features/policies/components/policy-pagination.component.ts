import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PAGE_SIZES } from '../../../core/models/policy-filter.model';
import { IconComponent } from '../../../shared/ui/icon.component';
import { formatNumber } from '../../../shared/utils/format';

/** Page numbers with ellipsis gaps, e.g. 1 … 4 [5] 6 … 625. */
function buildPages(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | 'gap')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('gap');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push('gap');
  pages.push(total);
  return pages;
}

@Component({
  standalone: true,
  selector: 'app-policy-pagination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent],
  template: `
    <nav
      class="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
      style="border-top: 1px solid var(--border);"
      aria-label="Pagination"
    >
      <div class="flex items-center gap-4">
        <label class="flex items-center gap-2 text-[13px]" style="color: var(--text-muted);">
          <span class="whitespace-nowrap">Rows per page</span>
          <select
            [ngModel]="size()"
            (ngModelChange)="sizeChange.emit(+$event)"
            class="h-8 rounded-md border px-1.5 text-[13px] outline-none focus:border-[var(--brand)]"
            style="background: var(--surface); border-color: var(--border); color: var(--text);"
          >
            @for (option of pageSizes; track option) {
              <option [ngValue]="option">{{ option }}</option>
            }
          </select>
        </label>

        <p class="tabular text-[13px] whitespace-nowrap" style="color: var(--text-muted);">
          @if (total() === 0) {
            No results
          } @else {
            Showing {{ formatNumber(from()) }}–{{ formatNumber(to()) }} of
            {{ formatNumber(total()) }}
          }
        </p>
      </div>

      <div class="flex items-center gap-1">
        <button
          type="button"
          class="flex h-8 items-center gap-1 rounded-md border px-2 text-[13px] font-medium transition-colors enabled:hover:bg-[var(--surface-hover)] disabled:opacity-40"
          style="background: var(--surface); border-color: var(--border); color: var(--text);"
          [disabled]="page() <= 1"
          (click)="pageChange.emit(page() - 1)"
        >
          <app-icon name="chevron-left" [size]="15" />
          <span class="max-sm:sr-only">Previous</span>
        </button>

        <div class="flex items-center gap-0.5 max-sm:hidden">
          @for (item of pages(); track $index) {
            @if (item === 'gap') {
              <span class="px-1.5 text-[13px]" style="color: var(--text-subtle);" aria-hidden="true"
                >…</span
              >
            } @else {
              <button
                type="button"
                class="tabular h-8 min-w-8 rounded-md px-2 text-[13px] font-medium transition-colors"
                [style.background]="item === page() ? 'var(--brand)' : 'transparent'"
                [style.color]="item === page() ? '#fff' : 'var(--text-muted)'"
                [attr.aria-current]="item === page() ? 'page' : null"
                [attr.aria-label]="'Page ' + item"
                (click)="pageChange.emit(item)"
              >
                {{ item }}
              </button>
            }
          }
        </div>

        <span class="tabular px-2 text-[13px] sm:hidden" style="color: var(--text-muted);">
          {{ page() }} / {{ totalPages() || 1 }}
        </span>

        <button
          type="button"
          class="flex h-8 items-center gap-1 rounded-md border px-2 text-[13px] font-medium transition-colors enabled:hover:bg-[var(--surface-hover)] disabled:opacity-40"
          style="background: var(--surface); border-color: var(--border); color: var(--text);"
          [disabled]="page() >= totalPages()"
          (click)="pageChange.emit(page() + 1)"
        >
          <span class="max-sm:sr-only">Next</span>
          <app-icon name="chevron-right" [size]="15" />
        </button>
      </div>
    </nav>
  `,
})
export class PolicyPaginationComponent {
  readonly page = input(1);
  readonly size = input(20);
  readonly totalPages = input(0);
  readonly total = input(0);
  readonly from = input(0);
  readonly to = input(0);

  readonly pageChange = output<number>();
  readonly sizeChange = output<number>();

  protected readonly pageSizes = PAGE_SIZES;
  protected readonly formatNumber = formatNumber;
  protected readonly pages = computed(() => buildPages(this.page(), this.totalPages()));
}
