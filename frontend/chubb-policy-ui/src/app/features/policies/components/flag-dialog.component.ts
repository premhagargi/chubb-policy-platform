import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../shared/ui/icon.component';

/**
 * Flag confirmation. The reason field is captured for the operator's benefit but is
 * deliberately not sent — PATCH /policies/flag accepts only { policyIds }, and inventing
 * a field the API ignores would be misleading. Noted in the UI copy instead.
 */
@Component({
  standalone: true,
  selector: 'app-flag-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent],
  host: { '(document:keydown.escape)': 'cancel.emit()' },
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div class="animate-fade-in absolute inset-0 bg-black/50" (click)="cancel.emit()" aria-hidden="true"></div>

        <div
          class="animate-dialog-in relative w-full max-w-md rounded-xl border p-5 shadow-2xl"
          style="background: var(--surface); border-color: var(--border);"
          role="dialog"
          aria-modal="true"
          aria-labelledby="flag-dialog-title"
        >
          <div class="flex items-start gap-3">
            <span
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style="background: var(--flag-bg); color: var(--flag);"
            >
              <app-icon name="flag" [size]="18" />
            </span>
            <div class="min-w-0 flex-1">
              <h2 id="flag-dialog-title" class="text-[15px] font-semibold" style="color: var(--text);">
                Flag {{ count() === 1 ? 'policy' : 'selected policies' }}
              </h2>
              <p class="mt-1 text-[13px]" style="color: var(--text-muted);">
                You are about to flag
                <strong style="color: var(--text);">{{ count() }}</strong>
                {{ count() === 1 ? 'policy' : 'policies' }} for review. Flagged policies stay
                visible to the operations team until cleared.
              </p>
            </div>
          </div>

          <label class="mt-4 block">
            <span class="mb-1 block text-[11px] font-medium uppercase tracking-wide" style="color: var(--text-muted);">
              Reason <span class="normal-case" style="color: var(--text-subtle);">(optional, not persisted)</span>
            </span>
            <textarea
              [ngModel]="reason()"
              (ngModelChange)="reason.set($event)"
              rows="3"
              placeholder="Add context for the review team…"
              class="w-full resize-none rounded-md border px-2.5 py-2 text-[13px] outline-none placeholder:text-[var(--text-subtle)] focus:border-[var(--brand)]"
              style="background: var(--surface); border-color: var(--border); color: var(--text);"
            ></textarea>
          </label>

          <div class="mt-4 flex justify-end gap-2">
            <button
              type="button"
              class="h-9 rounded-md border px-3.5 text-[13px] font-medium transition-colors hover:bg-[var(--surface-hover)]"
              style="background: var(--surface); border-color: var(--border); color: var(--text);"
              (click)="cancel.emit()"
            >
              Cancel
            </button>
            <button
              type="button"
              class="flex h-9 items-center gap-1.5 rounded-md px-3.5 text-[13px] font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              style="background: var(--brand); color: var(--brand-contrast);"
              [disabled]="busy()"
              (click)="confirm.emit()"
            >
              @if (busy()) {
                <svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" opacity="0.3" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
                </svg>
              }
              {{ busy() ? 'Flagging…' : 'Flag ' + (count() === 1 ? 'policy' : count() + ' policies') }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class FlagDialogComponent {
  readonly open = input(false);
  readonly count = input(0);
  readonly busy = input(false);

  readonly confirm = output<void>();
  readonly cancel = output<void>();

  protected readonly reason = signal('');
}
