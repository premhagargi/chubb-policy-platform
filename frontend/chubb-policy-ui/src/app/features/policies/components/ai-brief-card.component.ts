import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { AiUsage, toAiScope } from '../../../core/models/ai.model';
import { PolicyFilter } from '../../../core/models/policy-filter.model';
import { AiService } from '../../../core/services/ai.service';
import { IconComponent } from '../../../shared/ui/icon.component';
import { MarkdownTextComponent } from '../../../shared/ui/markdown-text.component';
import { SpinnerComponent } from '../../../shared/ui/spinner.component';

/**
 * AI portfolio brief for the dashboard overview.
 *
 * Generated on demand rather than on load: an LLM call on every dashboard visit
 * would spend tokens the user did not ask for and delay first paint. The button
 * makes the cost explicit and the result a deliberate act.
 */
@Component({
  standalone: true,
  selector: 'app-ai-brief-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SpinnerComponent, MarkdownTextComponent],
  template: `
    <section class="surface-card px-4 py-4">
      <header class="flex items-center gap-2">
        <span
          class="flex h-7 w-7 items-center justify-center rounded-md"
          style="background: color-mix(in srgb, var(--brand) 12%, transparent); color: var(--brand);"
        >
          <app-icon name="sparkle" [size]="15" />
        </span>
        <h2 class="flex-1 text-[15px] font-semibold tracking-tight" style="color: var(--text);">
          AI Portfolio Brief
        </h2>

        <button
          type="button"
          class="flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-50"
          style="background: var(--surface); border-color: var(--border); color: var(--text);"
          [disabled]="loading()"
          (click)="generate()"
        >
          @if (loading()) {
            <app-spinner [size]="14" />
            Generating…
          } @else {
            <app-icon name="sparkle" [size]="14" />
            {{ brief() ? 'Regenerate' : 'Generate brief' }}
          }
        </button>
      </header>

      <div class="mt-3" aria-live="polite">
        @if (error(); as message) {
          <p
            class="flex items-start gap-2 rounded-md px-3 py-2 text-[13px]"
            style="background: var(--status-cancelled-bg); color: var(--status-cancelled);"
          >
            <app-icon name="alert" [size]="14" />
            {{ message }}
          </p>
        } @else if (loading()) {
          <div class="space-y-2">
            @for (i of [1, 2, 3]; track i) {
              <div class="skeleton h-3.5" [style.width]="i === 3 ? '65%' : '100%'"></div>
            }
          </div>
        } @else {
          <!-- An 'as' alias is only allowed on @if, never on @else if. -->
          @if (brief(); as text) {
          <div class="text-[13px] leading-relaxed" style="color: var(--text);">
            <app-markdown-text [value]="text" />
          </div>

          @if (usage(); as u) {
            <p class="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]" style="color: var(--text-subtle);">
              <span>{{ u.provider }} · {{ u.model }}</span>
              <span aria-hidden="true">·</span>
              <span>{{ u.latencyMs }} ms</span>
              @if (u.cached) {
                <span
                  class="rounded-full px-1.5 py-0.5 font-medium"
                  style="background: var(--surface-hover); color: var(--text-muted);"
                  title="Served from the server's in-memory cache"
                >cached</span>
              }
            </p>
          }
          } @else {
            <p class="text-[13px]" style="color: var(--text-subtle);">
              Generate a three-point executive summary of the policies currently in view.
            </p>
          }
        }
      </div>
    </section>
  `,
})
export class AiBriefCardComponent {
  private readonly ai = inject(AiService);

  readonly filter = input.required<PolicyFilter>();

  protected readonly brief = signal<string | null>(null);
  protected readonly usage = signal<AiUsage | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected generate(): void {
    if (this.loading()) return;

    this.loading.set(true);
    this.error.set(null);

    this.ai.portfolioBrief(toAiScope(this.filter())).subscribe({
      next: (response) => {
        this.brief.set(response.brief);
        this.usage.set(response.usage);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to generate the brief. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
