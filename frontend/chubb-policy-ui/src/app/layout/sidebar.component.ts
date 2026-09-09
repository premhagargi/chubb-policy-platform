import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent, IconName } from '../shared/ui/icon.component';

interface NavItem {
  label: string;
  route: string;
  icon: IconName;
  /** Query params baked into the link — how "Flagged" becomes a real filtered view
   *  rather than a separate page with duplicated logic. */
  queryParams?: Record<string, string>;
}

const PRIMARY_NAV: NavItem[] = [
  { label: 'Dashboard', route: '/dashboard', icon: 'dashboard' },
  { label: 'Policies', route: '/policies', icon: 'policies' },
  { label: 'Flagged', route: '/flagged', icon: 'flag' },
];

const SECONDARY_NAV: NavItem[] = [{ label: 'Settings', route: '/settings', icon: 'settings' }];

@Component({
  standalone: true,
  selector: 'app-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  host: { class: 'contents' },
  template: `
    <!-- Mobile scrim -->
    @if (open()) {
      <div
        class="animate-fade-in fixed inset-0 z-40 bg-black/50 lg:hidden"
        (click)="close.emit()"
        aria-hidden="true"
      ></div>
    }

    <aside
      class="fixed inset-y-0 left-0 z-50 flex w-[208px] flex-col transition-transform duration-200 lg:static lg:translate-x-0"
      [class.translate-x-0]="open()"
      [class.-translate-x-full]="!open()"
      style="background: var(--chrome-bg); border-right: 1px solid var(--chrome-border);"
    >
      <!-- Brand -->
      <div
        class="flex h-14 shrink-0 items-center gap-2.5 px-4"
        style="border-bottom: 1px solid var(--chrome-border);"
      >
        <span
          class="flex h-7 w-7 items-center justify-center rounded font-bold text-[13px] tracking-tight"
          style="background: var(--brand); color: var(--brand-contrast);"
          aria-hidden="true"
          >C</span
        >
        <span class="min-w-0">
          <span class="block text-[13px] font-semibold leading-tight tracking-tight"
            style="color: var(--chrome-text-active);"
            >CHUBB</span
          >
          <span class="block text-[11px] leading-tight" style="color: var(--chrome-text);"
            >Policy Platform</span
          >
        </span>
        <button
          type="button"
          class="ml-auto rounded p-1 transition-colors hover:bg-[var(--chrome-hover)] lg:hidden"
          style="color: var(--chrome-text);"
          (click)="close.emit()"
          aria-label="Close navigation"
        >
          <app-icon name="close" [size]="18" />
        </button>
      </div>

      <!-- Primary nav -->
      <nav class="flex-1 overflow-y-auto px-3 py-4" aria-label="Main">
        <ul class="flex flex-col gap-0.5">
          @for (item of primaryNav; track item.route) {
            <li>
              <a
                [routerLink]="item.route"
                [queryParams]="item.queryParams ?? {}"
                routerLinkActive="nav-active"
                [routerLinkActiveOptions]="{ exact: false }"
                #rla="routerLinkActive"
                class="group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors"
                [style.color]="rla.isActive ? 'var(--chrome-text-active)' : 'var(--chrome-text)'"
                [style.background]="rla.isActive ? 'var(--chrome-active)' : 'transparent'"
                [attr.aria-current]="rla.isActive ? 'page' : null"
                (click)="close.emit()"
              >
                @if (rla.isActive) {
                  <span
                    class="absolute inset-y-1.5 left-0 w-0.5 rounded-full"
                    style="background: var(--brand);"
                    aria-hidden="true"
                  ></span>
                }
                <app-icon [name]="item.icon" [size]="17" />
                {{ item.label }}
              </a>
            </li>
          }
        </ul>

        <div class="my-4 h-px" style="background: var(--chrome-border);"></div>

        <ul class="flex flex-col gap-0.5">
          @for (item of secondaryNav; track item.route) {
            <li>
              <a
                [routerLink]="item.route"
                routerLinkActive="nav-active"
                #rla2="routerLinkActive"
                class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors"
                [style.color]="rla2.isActive ? 'var(--chrome-text-active)' : 'var(--chrome-text)'"
                [style.background]="rla2.isActive ? 'var(--chrome-active)' : 'transparent'"
                [attr.aria-current]="rla2.isActive ? 'page' : null"
                (click)="close.emit()"
              >
                <app-icon [name]="item.icon" [size]="17" />
                {{ item.label }}
              </a>
            </li>
          }
        </ul>
      </nav>

      <!-- User -->
      <div class="p-3" style="border-top: 1px solid var(--chrome-border);">
        <div class="flex items-center gap-2.5 rounded-md px-2 py-2">
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
            style="background: var(--brand); color: var(--brand-contrast);"
            aria-hidden="true"
            >P</span
          >
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[13px] font-medium" style="color: var(--chrome-text-active);">Prem</span>
            <span class="block truncate text-[11px]" style="color: var(--chrome-text);"
              >Administrator</span
            >
          </span>
        </div>
      </div>
    </aside>
  `,
  styles: [
    `
      a:hover:not(.nav-active) {
        background: var(--chrome-hover) !important;
        color: var(--chrome-text-active) !important;
      }
    `,
  ],
})
export class SidebarComponent {
  readonly open = input(false);
  readonly close = output<void>();

  protected readonly primaryNav = PRIMARY_NAV;
  protected readonly secondaryNav = SECONDARY_NAV;
}
