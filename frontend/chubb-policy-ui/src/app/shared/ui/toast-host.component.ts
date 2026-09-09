import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IconComponent } from './icon.component';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div
      class="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-full max-w-sm flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      @for (toast of toasts(); track toast.id) {
        <div
          class="animate-toast-in pointer-events-auto flex items-start gap-2.5 rounded-lg border px-3.5 py-3 shadow-lg"
          style="background: var(--surface); border-color: var(--border);"
        >
          <span
            class="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full"
            [style.color]="toast.variant === 'error' ? 'var(--status-cancelled)' : 'var(--status-active)'"
          >
            <app-icon [name]="toast.variant === 'error' ? 'alert' : 'check'" [size]="15" />
          </span>
          <p class="flex-1 text-sm" style="color: var(--text);">{{ toast.message }}</p>
          <button
            type="button"
            class="rounded p-0.5 transition-colors hover:bg-[var(--surface-hover)]"
            style="color: var(--text-subtle);"
            (click)="dismiss(toast.id)"
            [attr.aria-label]="'Dismiss notification: ' + toast.message"
          >
            <app-icon name="close" [size]="14" />
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastHostComponent {
  private readonly service = inject(ToastService);
  protected readonly toasts = this.service.toasts;

  protected dismiss(id: number): void {
    this.service.dismiss(id);
  }
}
