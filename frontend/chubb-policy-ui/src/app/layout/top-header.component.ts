import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output, signal } from '@angular/core';
import { IconComponent } from '../shared/ui/icon.component';
import { ThemeService } from '../core/services/theme.service';

@Component({
  standalone: true,
  selector: 'app-top-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: {
    class: 'sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 px-4 lg:px-6',
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'menuOpen.set(false)',
  },
  styles: [
    `
      :host {
        background: var(--surface);
        border-bottom: 1px solid var(--border);
      }
    `,
  ],
  template: `
    <button
      type="button"
      class="-ml-1 rounded-md p-1.5 transition-colors hover:bg-[var(--surface-hover)] lg:hidden"
      style="color: var(--text-muted);"
      (click)="toggleNav.emit()"
      aria-label="Open navigation"
    >
      <app-icon name="menu" [size]="20" />
    </button>

    <h1 class="text-sm font-semibold tracking-tight" style="color: var(--text);">
      {{ pageTitle() }}
    </h1>

    <div class="ml-auto flex items-center gap-1">
      <button
        type="button"
        class="rounded-md p-2 transition-colors hover:bg-[var(--surface-hover)]"
        style="color: var(--text-muted);"
        (click)="theme.toggle()"
        [attr.aria-label]="
          theme.resolvedTheme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
        "
      >
        <app-icon [name]="theme.resolvedTheme() === 'dark' ? 'sun' : 'moon'" [size]="17" />
      </button>

      <button
        type="button"
        class="relative rounded-md p-2 transition-colors hover:bg-[var(--surface-hover)]"
        style="color: var(--text-muted);"
        aria-label="Notifications"
      >
        <app-icon name="bell" [size]="17" />
      </button>

      <button
        type="button"
        class="hidden rounded-md p-2 transition-colors hover:bg-[var(--surface-hover)] sm:block"
        style="color: var(--text-muted);"
        aria-label="Help"
      >
        <app-icon name="help" [size]="17" />
      </button>

      <div class="mx-1 h-5 w-px" style="background: var(--border);"></div>

      <div class="relative">
        <button
          type="button"
          class="flex items-center gap-2 rounded-md py-1 pl-1 pr-1.5 transition-colors hover:bg-[var(--surface-hover)]"
          (click)="menuOpen.set(!menuOpen()); $event.stopPropagation()"
          [attr.aria-expanded]="menuOpen()"
          aria-haspopup="menu"
        >
          <span
            class="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white"
            style="background: var(--brand);"
            aria-hidden="true"
            >P</span
          >
          <span class="hidden text-[13px] font-medium sm:block" style="color: var(--text);"
            >Prem</span
          >
          <app-icon name="chevron-down" [size]="14" />
        </button>

        @if (menuOpen()) {
          <div
            class="animate-fade-in absolute right-0 top-full z-40 mt-1.5 w-52 overflow-hidden rounded-lg border shadow-lg"
            style="background: var(--surface); border-color: var(--border);"
            role="menu"
          >
            <div class="px-3 py-2.5" style="border-bottom: 1px solid var(--border);">
              <p class="text-[13px] font-medium" style="color: var(--text);">Prem</p>
              <p class="text-xs" style="color: var(--text-muted);">Administrator</p>
            </div>
            <div class="p-1">
              @for (item of menuItems; track item) {
                <button
                  type="button"
                  role="menuitem"
                  class="w-full rounded px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-[var(--surface-hover)]"
                  style="color: var(--text-muted);"
                  (click)="menuOpen.set(false)"
                >
                  {{ item }}
                </button>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class TopHeaderComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  protected readonly theme = inject(ThemeService);

  readonly pageTitle = input('Policy Operations');
  readonly toggleNav = output<void>();

  protected readonly menuOpen = signal(false);
  protected readonly menuItems = ['Profile', 'Preferences', 'Sign out'];

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.menuOpen()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) this.menuOpen.set(false);
  }
}
