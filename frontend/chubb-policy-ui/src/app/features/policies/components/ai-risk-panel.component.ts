import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RiskAssessment } from '../../../core/models/ai.model';
import { AiService } from '../../../core/services/ai.service';
import { IconComponent } from '../../../shared/ui/icon.component';
import { SpinnerComponent } from '../../../shared/ui/spinner.component';

/**
 * AI underwriting triage for a single policy, shown inside the detail drawer.
 *
 * This is the feature that ties the model to the domain rather than bolting a
 * chatbot onto the side: when the assessment says the policy warrants review, it
 * offers the same flag action the operator would otherwise take manually, so the
 * AI output ends in a real state change instead of a paragraph.
 */
@Component({
  standalone: true,
  selector: 'app-ai-risk-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SpinnerComponent],
  template: `
    <section class="mt-5">
      <div class="flex items-center gap-2">
        <h3
          class="flex-1 text-[11px] font-medium uppercase tracking-wide"
          style="color: var(--text-muted);"
        >
          AI Risk Assessment
        </h3>

        @if (!loading()) {
          <button
            type="button"
            class="flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors hover:bg-[var(--surface-hover)]"
            style="background: var(--surface); border-color: var(--border); color: var(--text);"
            (click)="assess()"
          >
            <app-icon name="sparkle" [size]="13" />
            {{ result() ? 'Re-run' : 'Assess' }}
          </button>
        }
      </div>

      <div class="mt-2.5" aria-live="polite">
        @if (loading()) {
          <p class="flex items-center gap-2 text-[13px]" style="color: var(--text-muted);">
            <app-spinner [size]="14" />
            Assessing risk…
          </p>
        } @else if (error()) {
          <p
            class="flex items-start gap-2 rounded-md px-3 py-2 text-[13px]"
            style="background: var(--accent-bg); color: var(--accent);"
          >
            <app-icon name="alert" [size]="14" />
            {{ error() }}
          </p>
        } @else {
          <!-- An 'as' alias is only allowed on @if, never on @else if, so the
               result branch is nested rather than chained. -->
          @if (result(); as assessment) {
          <!-- Score -->
          <div class="rounded-lg p-3" style="background: var(--surface-hover);">
            <div class="flex items-baseline justify-between gap-3">
              <span
                class="rounded-full px-2 py-0.5 text-xs font-semibold"
                [style.background]="bandBackground()"
                [style.color]="bandColor()"
              >
                {{ assessment.riskBand }} risk
              </span>
              <span class="tabular text-lg font-semibold" style="color: var(--text);">
                {{ assessment.riskScore }}<span class="text-xs" style="color: var(--text-subtle);">/100</span>
              </span>
            </div>

            <!-- Score bar -->
            <div
              class="mt-2 h-1.5 overflow-hidden rounded-full"
              style="background: var(--border);"
              role="img"
              [attr.aria-label]="'Risk score ' + assessment.riskScore + ' out of 100'"
            >
              <div
                class="h-full rounded-full transition-[width] duration-500"
                [style.width.%]="assessment.riskScore"
                [style.background]="bandColor()"
              ></div>
            </div>

            <p class="mt-2.5 text-[13px] leading-relaxed" style="color: var(--text);">
              {{ assessment.summary }}
            </p>
          </div>

          <!-- Factors -->
          @if (assessment.factors.length) {
            <ul class="mt-2.5 space-y-1.5">
              @for (factor of assessment.factors; track factor) {
                <li class="flex items-start gap-2 text-[13px]" style="color: var(--text-muted);">
                  <span class="mt-1.5 h-1 w-1 shrink-0 rounded-full" style="background: var(--text-subtle);"></span>
                  {{ factor }}
                </li>
              }
            </ul>
          }

          <p class="mt-2.5 text-[13px]" style="color: var(--text-muted);">
            <span class="font-medium" style="color: var(--text);">Recommendation:</span>
            {{ assessment.recommendation }}
          </p>

          @if (assessment.suggestFlag && !flagged()) {
            <button
              type="button"
              class="mt-2.5 flex h-8 w-full items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              style="background: var(--brand); color: var(--brand-contrast);"
              [disabled]="flagInFlight()"
              (click)="flagSuggested.emit()"
            >
              <app-icon name="flag" [size]="14" />
              Flag as recommended
            </button>
          }

          <p class="mt-2 text-[11px]" style="color: var(--text-subtle);">
            {{ assessment.usage.provider }} · {{ assessment.usage.model }} ·
            {{ assessment.usage.latencyMs }} ms{{ assessment.usage.cached ? ' · cached' : '' }}
          </p>
          } @else {
            <p class="text-[13px]" style="color: var(--text-subtle);">
              Run an AI assessment to score this policy's review priority.
            </p>
          }
        }
      </div>
    </section>
  `,
})
export class AiRiskPanelComponent {
  private readonly ai = inject(AiService);

  readonly policyId = input.required<string>();
  readonly flagInFlight = input(false);

  /**
   * Live flag state of the policy, not the value captured when the assessment
   * ran. The server suppresses `suggestFlag` for an already-flagged policy, but
   * an assessment taken *before* the operator flagged it still carries
   * `suggestFlag: true` — so the recommendation has to be re-checked against
   * current state, or the button survives its own action.
   */
  readonly flagged = input(false);

  readonly flagSuggested = output<void>();

  protected readonly result = signal<RiskAssessment | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    // The drawer reuses one component instance across policies, so a stale
    // assessment must never linger against a different policy.
    // allowSignalWrites is required on Angular 18 (NG0600); it became the
    // default in v19.
    effect(
      () => {
        this.policyId();
        this.result.set(null);
        this.error.set(null);
        this.loading.set(false);
      },
      { allowSignalWrites: true }
    );
  }

  protected assess(): void {
    if (this.loading()) return;

    this.loading.set(true);
    this.error.set(null);

    const requestedFor = this.policyId();

    this.ai.assessPolicy(requestedFor).subscribe({
      next: (assessment) => {
        // Ignore a response that arrived after the user moved to another policy.
        if (this.policyId() !== requestedFor) return;

        this.result.set(assessment);
        this.loading.set(false);
      },
      error: () => {
        if (this.policyId() !== requestedFor) return;

        this.error.set('Unable to assess this policy. Please try again.');
        this.loading.set(false);
      },
    });
  }

  // Monochrome plus one hue: High takes the accent because it is the state that
  // asks something of the operator; Medium and Low recede into greyscale.
  protected readonly bandColor = computed(() => {
    switch (this.result()?.riskBand) {
      case 'High':
        return 'var(--accent)';
      case 'Medium':
        return 'var(--text)';
      default:
        return 'var(--text-muted)';
    }
  });

  protected readonly bandBackground = computed(() => {
    switch (this.result()?.riskBand) {
      case 'High':
        return 'var(--accent-bg)';
      default:
        return 'var(--surface-hover)';
    }
  });
}
