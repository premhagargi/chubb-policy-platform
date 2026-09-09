import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LINES_OF_BUSINESS,
  POLICY_STATUSES,
  REGIONS,
} from '../../../core/models/policy.model';
import { PolicyFilter } from '../../../core/models/policy-filter.model';
import { IconComponent } from '../../../shared/ui/icon.component';

const SEARCH_DEBOUNCE_MS = 350;

interface Chip {
  key: keyof PolicyFilter;
  label: string;
}

@Component({
  standalone: true,
  selector: 'app-policy-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent],
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'panelOpen.set(false)',
  },
  template: `
    <div class="flex flex-col gap-3 p-4" style="border-bottom: 1px solid var(--border);">
      <div class="flex flex-wrap items-center gap-2">
        <!-- Search -->
        <div class="relative min-w-[200px] flex-1 sm:max-w-xs">
          <span
            class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
            style="color: var(--text-subtle);"
          >
            <app-icon name="search" [size]="15" />
          </span>
          <input
            type="search"
            [ngModel]="searchText()"
            (ngModelChange)="onSearchInput($event)"
            placeholder="Search policy, holder, underwriter…"
            aria-label="Search policies"
            class="h-9 w-full rounded-md border pl-8 pr-3 text-[13px] transition-colors outline-none placeholder:text-[var(--text-subtle)] focus:border-[var(--brand)]"
            style="background: var(--surface); border-color: var(--border); color: var(--text);"
          />
          @if (searching()) {
            <span class="absolute right-2.5 top-1/2 -translate-y-1/2" style="color: var(--text-subtle);">
              <svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" opacity="0.25" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
              </svg>
            </span>
          }
        </div>

        <!-- Filters -->
        <div class="relative">
          <button
            type="button"
            class="flex h-9 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium transition-colors hover:bg-[var(--surface-hover)]"
            style="background: var(--surface); border-color: var(--border); color: var(--text);"
            [style.border-color]="activeCount() > 0 ? 'var(--brand)' : 'var(--border)'"
            (click)="panelOpen.set(!panelOpen()); $event.stopPropagation()"
            [attr.aria-expanded]="panelOpen()"
          >
            <app-icon name="filter" [size]="15" />
            Filters
            @if (activeCount() > 0) {
              <span
                class="tabular ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold"
                style="background: var(--brand); color: var(--brand-contrast);"
                >{{ activeCount() }}</span
              >
            }
          </button>

          @if (panelOpen()) {
            <div
              class="animate-fade-in absolute left-0 top-full z-40 mt-1.5 w-[360px] rounded-lg border p-3.5 shadow-lg"
              style="background: var(--surface); border-color: var(--border);"
              (click)="$event.stopPropagation()"
            >
              <div class="space-y-3">
                <label class="block">
                  <span class="mb-1 block text-[11px] font-medium uppercase tracking-wide" style="color: var(--text-muted);">Status</span>
                  <select
                    [ngModel]="filter().status"
                    (ngModelChange)="change.emit({ status: $event || null })"
                    class="h-9 w-full rounded-md border px-2 text-[13px] outline-none focus:border-[var(--brand)]"
                    style="background: var(--surface); border-color: var(--border); color: var(--text);"
                  >
                    <option [ngValue]="null">All statuses</option>
                    @for (s of statuses; track s) {
                      <option [ngValue]="s">{{ s }}</option>
                    }
                  </select>
                </label>

                <label class="block">
                  <span class="mb-1 block text-[11px] font-medium uppercase tracking-wide" style="color: var(--text-muted);">Line of Business</span>
                  <select
                    [ngModel]="filter().lineOfBusiness"
                    (ngModelChange)="change.emit({ lineOfBusiness: $event || null })"
                    class="h-9 w-full rounded-md border px-2 text-[13px] outline-none focus:border-[var(--brand)]"
                    style="background: var(--surface); border-color: var(--border); color: var(--text);"
                  >
                    <option [ngValue]="null">All lines</option>
                    @for (l of linesOfBusiness; track l) {
                      <option [ngValue]="l">{{ l }}</option>
                    }
                  </select>
                </label>

                <label class="block">
                  <span class="mb-1 block text-[11px] font-medium uppercase tracking-wide" style="color: var(--text-muted);">Region</span>
                  <select
                    [ngModel]="filter().region"
                    (ngModelChange)="change.emit({ region: $event || null })"
                    class="h-9 w-full rounded-md border px-2 text-[13px] outline-none focus:border-[var(--brand)]"
                    style="background: var(--surface); border-color: var(--border); color: var(--text);"
                  >
                    <option [ngValue]="null">All regions</option>
                    @for (r of regions; track r) {
                      <option [ngValue]="r">{{ r }}</option>
                    }
                  </select>
                </label>

                <label class="block">
                  <span class="mb-1 block text-[11px] font-medium uppercase tracking-wide" style="color: var(--text-muted);">Review state</span>
                  <select
                    [ngModel]="flaggedValue()"
                    (ngModelChange)="onFlaggedChange($event)"
                    class="h-9 w-full rounded-md border px-2 text-[13px] outline-none focus:border-[var(--brand)]"
                    style="background: var(--surface); border-color: var(--border); color: var(--text);"
                  >
                    <option value="">All policies</option>
                    <option value="true">Flagged only</option>
                    <option value="false">Not flagged</option>
                  </select>
                </label>

                <fieldset>
                  <legend class="mb-1 block text-[11px] font-medium uppercase tracking-wide" style="color: var(--text-muted);">Effective date</legend>
                  <div class="flex items-center gap-2">
                    <input
                      type="date"
                      [ngModel]="filter().effectiveDateFrom"
                      (ngModelChange)="change.emit({ effectiveDateFrom: $event || null })"
                      aria-label="Effective date from"
                      class="h-9 w-full rounded-md border px-2 text-[13px] outline-none focus:border-[var(--brand)]"
                      style="background: var(--surface); border-color: var(--border); color: var(--text);"
                    />
                    <span style="color: var(--text-subtle);">–</span>
                    <input
                      type="date"
                      [ngModel]="filter().effectiveDateTo"
                      (ngModelChange)="change.emit({ effectiveDateTo: $event || null })"
                      aria-label="Effective date to"
                      class="h-9 w-full rounded-md border px-2 text-[13px] outline-none focus:border-[var(--brand)]"
                      style="background: var(--surface); border-color: var(--border); color: var(--text);"
                    />
                  </div>
                </fieldset>
              </div>

              <div class="mt-3.5 flex justify-between gap-2 pt-3" style="border-top: 1px solid var(--border);">
                <button
                  type="button"
                  class="rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors hover:bg-[var(--surface-hover)]"
                  style="color: var(--text-muted);"
                  (click)="clearAll.emit()"
                >
                  Clear all
                </button>
                <button
                  type="button"
                  class="rounded-md px-3 py-1.5 text-[13px] font-medium transition-opacity hover:opacity-90"
                  style="background: var(--brand); color: var(--brand-contrast);"
                  (click)="panelOpen.set(false)"
                >
                  Done
                </button>
              </div>
            </div>
          }
        </div>

        <div class="ml-auto flex items-center gap-2">
          <button
            type="button"
            class="flex h-9 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium transition-colors hover:bg-[var(--surface-hover)]"
            style="background: var(--surface); border-color: var(--border); color: var(--text);"
            (click)="exportCsv.emit()"
          >
            <app-icon name="download" [size]="15" />
            <span class="max-sm:sr-only">Export</span>
          </button>
        </div>
      </div>

      <!-- Active filter chips -->
      @if (chips().length > 0) {
        <div class="flex flex-wrap items-center gap-1.5">
          @for (chip of chips(); track chip.key) {
            <span
              class="inline-flex items-center gap-1 rounded-md py-1 pl-2 pr-1 text-xs font-medium"
              style="background: var(--surface-hover); color: var(--text-muted);"
            >
              {{ chip.label }}
              <button
                type="button"
                class="rounded p-0.5 transition-colors hover:bg-[var(--border)]"
                (click)="clearOne.emit(chip.key)"
                [attr.aria-label]="'Remove filter ' + chip.label"
              >
                <app-icon name="close" [size]="12" />
              </button>
            </span>
          }
          <button
            type="button"
            class="ml-0.5 rounded px-1.5 py-1 text-xs font-medium underline-offset-2 hover:underline"
            style="color: var(--brand);"
            (click)="clearAll.emit()"
          >
            Clear all
          </button>
        </div>
      }
    </div>
  `,
})
export class PolicyToolbarComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly filter = input.required<PolicyFilter>();
  readonly activeCount = input(0);
  readonly searching = input(false);

  readonly change = output<Partial<PolicyFilter>>();
  readonly clearAll = output<void>();
  readonly clearOne = output<keyof PolicyFilter>();
  readonly exportCsv = output<void>();

  protected readonly panelOpen = signal(false);
  protected readonly searchText = signal('');

  protected readonly statuses = POLICY_STATUSES;
  protected readonly linesOfBusiness = LINES_OF_BUSINESS;
  protected readonly regions = REGIONS;

  private debounceHandle: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Keep the box in step when the filter changes from elsewhere (chip removal,
    // "clear all", a deep link) without stomping on what the user is typing.
    // allowSignalWrites is required on Angular 18 (NG0600); it became the
    // default in v19.
    effect(
      () => {
        const incoming = this.filter().search ?? '';
        if (this.debounceHandle === null && incoming !== this.searchText()) {
          this.searchText.set(incoming);
        }
      },
      { allowSignalWrites: true }
    );
  }

  protected onSearchInput(value: string): void {
    this.searchText.set(value);
    if (this.debounceHandle !== null) clearTimeout(this.debounceHandle);
    this.debounceHandle = setTimeout(() => {
      this.debounceHandle = null;
      this.change.emit({ search: value.trim() || null });
    }, SEARCH_DEBOUNCE_MS);
  }

  protected flaggedValue(): string {
    const flagged = this.filter().flagged;
    return flagged === null ? '' : String(flagged);
  }

  protected onFlaggedChange(value: string): void {
    this.change.emit({ flagged: value === '' ? null : value === 'true' });
  }

  protected chips(): Chip[] {
    const f = this.filter();
    const chips: Chip[] = [];
    if (f.status) chips.push({ key: 'status', label: `Status: ${f.status}` });
    if (f.lineOfBusiness) chips.push({ key: 'lineOfBusiness', label: `LOB: ${f.lineOfBusiness}` });
    if (f.region) chips.push({ key: 'region', label: `Region: ${f.region}` });
    if (f.search) chips.push({ key: 'search', label: `Search: "${f.search}"` });
    if (f.flagged !== null)
      chips.push({ key: 'flagged', label: f.flagged ? 'Flagged only' : 'Not flagged' });
    if (f.effectiveDateFrom)
      chips.push({ key: 'effectiveDateFrom', label: `From: ${f.effectiveDateFrom}` });
    if (f.effectiveDateTo) chips.push({ key: 'effectiveDateTo', label: `To: ${f.effectiveDateTo}` });
    return chips;
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.panelOpen()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) this.panelOpen.set(false);
  }
}
