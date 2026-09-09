import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Policy } from '../../../core/models/policy.model';
import { IconComponent } from '../../../shared/ui/icon.component';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge.component';
import { AiRiskPanelComponent } from './ai-risk-panel.component';
import { daysUntil, formatCurrency, formatDate } from '../../../shared/utils/format';

interface Field {
  label: string;
  value: string;
}

@Component({
  standalone: true,
  selector: 'app-policy-detail-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, StatusBadgeComponent, AiRiskPanelComponent],
  host: { '(document:keydown.escape)': 'close.emit()' },
  template: `
    @if (policy(); as p) {
      <div class="fixed inset-0 z-50">
        <div class="animate-fade-in absolute inset-0 bg-black/40" (click)="close.emit()" aria-hidden="true"></div>

        <aside
          class="animate-drawer-in absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col shadow-2xl"
          style="background: var(--surface);"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="'Policy details for ' + p.policyNumber"
        >
          <!-- Header -->
          <header class="flex items-start gap-3 px-5 py-4" style="border-bottom: 1px solid var(--border);">
            <div class="min-w-0 flex-1">
              <p class="text-[11px] font-medium uppercase tracking-wide" style="color: var(--text-muted);">
                Policy Details
              </p>
              <h2 class="tabular mt-1 truncate text-lg font-semibold tracking-tight" style="color: var(--text);">
                {{ p.policyNumber }}
              </h2>
              <div class="mt-2 flex flex-wrap items-center gap-1.5">
                <app-status-badge [status]="p.status" />
                @if (p.flaggedForReview) {
                  <span
                    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                    style="background: var(--flag-bg); color: var(--flag);"
                  >
                    <app-icon name="flag" [size]="11" />
                    Flagged
                  </span>
                }
              </div>
            </div>

            <button
              type="button"
              class="rounded-md p-1.5 transition-colors hover:bg-[var(--surface-hover)]"
              style="color: var(--text-muted);"
              (click)="close.emit()"
              aria-label="Close details"
            >
              <app-icon name="close" [size]="18" />
            </button>
          </header>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto px-5 py-4">
            @if (loading()) {
              <div class="space-y-5">
                @for (group of [1, 2]; track group) {
                  <div>
                    <div class="skeleton h-3 w-32"></div>
                    <div class="mt-3 space-y-3">
                      @for (i of [1, 2, 3, 4]; track i) {
                        <div>
                          <div class="skeleton h-2.5 w-20"></div>
                          <div class="skeleton mt-1.5 h-4 w-40"></div>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            } @else {
              <!-- Premium highlight -->
              <div class="rounded-lg p-3.5" style="background: var(--surface-hover);">
                <p class="text-[11px] font-medium uppercase tracking-wide" style="color: var(--text-muted);">
                  Written Premium
                </p>
                <p class="tabular mt-1 text-2xl font-semibold tracking-tight" style="color: var(--text);">
                  {{ formatCurrency(p.premiumAmount, p.currency) }}
                </p>
                <p class="mt-0.5 text-xs" style="color: var(--text-subtle);">{{ p.currency }}</p>
              </div>

              @if (expiryNote(); as note) {
                <p
                  class="mt-3 flex items-center gap-1.5 rounded-md px-3 py-2 text-xs"
                  [style.background]="note.urgent ? 'var(--flag-bg)' : 'var(--surface-hover)'"
                  [style.color]="note.urgent ? 'var(--flag)' : 'var(--text-muted)'"
                >
                  <app-icon name="clock" [size]="13" />
                  {{ note.text }}
                </p>
              }

              @for (section of sections(); track section.title) {
                <section class="mt-5">
                  <h3 class="text-[11px] font-medium uppercase tracking-wide" style="color: var(--text-muted);">
                    {{ section.title }}
                  </h3>
                  <dl class="mt-2.5 space-y-2.5">
                    @for (field of section.fields; track field.label) {
                      <div class="flex items-baseline justify-between gap-4">
                        <dt class="shrink-0 text-[13px]" style="color: var(--text-muted);">
                          {{ field.label }}
                        </dt>
                        <dd class="min-w-0 truncate text-right text-[13px] font-medium" style="color: var(--text);">
                          {{ field.value }}
                        </dd>
                      </div>
                    }
                  </dl>
                </section>
              }

              <app-ai-risk-panel
                [policyId]="p.id"
                [flagInFlight]="flagInFlight()"
                (flagSuggested)="flag.emit(p)"
              />
            }
          </div>

          <!-- Footer -->
          <footer class="flex items-center gap-2 px-5 py-3.5" style="border-top: 1px solid var(--border);">
            @if (p.flaggedForReview) {
              <p class="flex items-center gap-1.5 text-[13px]" style="color: var(--text-muted);">
                <app-icon name="check" [size]="14" />
                Already flagged for review
              </p>
            } @else {
              <button
                type="button"
                class="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style="background: var(--brand);"
                [disabled]="flagInFlight()"
                (click)="flag.emit(p)"
              >
                <app-icon name="flag" [size]="15" />
                {{ flagInFlight() ? 'Flagging…' : 'Flag Policy' }}
              </button>
            }
          </footer>
        </aside>
      </div>
    }
  `,
})
export class PolicyDetailDrawerComponent {
  readonly policy = input<Policy | null>(null);
  readonly loading = input(false);
  readonly flagInFlight = input(false);

  readonly close = output<void>();
  readonly flag = output<Policy>();

  protected readonly formatCurrency = formatCurrency;

  protected readonly sections = computed<{ title: string; fields: Field[] }[]>(() => {
    const p = this.policy();
    if (!p) return [];
    return [
      {
        title: 'Policy Information',
        fields: [
          { label: 'Policyholder', value: p.policyholderName },
          { label: 'Line of Business', value: p.lineOfBusiness },
          { label: 'Region', value: p.region },
          { label: 'Underwriter', value: p.underwriter },
        ],
      },
      {
        title: 'Coverage Period',
        fields: [
          { label: 'Effective Date', value: formatDate(p.effectiveDate) },
          { label: 'Expiry Date', value: formatDate(p.expiryDate) },
        ],
      },
      {
        title: 'Record',
        fields: [
          { label: 'Created', value: formatDate(p.createdAt) },
          { label: 'Last Updated', value: formatDate(p.updatedAt) },
          { label: 'Policy ID', value: p.id },
        ],
      },
    ];
  });

  protected readonly expiryNote = computed(() => {
    const p = this.policy();
    if (!p) return null;
    const days = daysUntil(p.expiryDate);
    if (days < 0) return { text: `Expired ${Math.abs(days)} days ago`, urgent: false };
    if (days === 0) return { text: 'Expires today', urgent: true };
    if (days <= 30) return { text: `Expires in ${days} days`, urgent: true };
    return { text: `Expires in ${days} days`, urgent: false };
  });
}
