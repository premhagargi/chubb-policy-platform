import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './sidebar.component';
import { TopHeaderComponent } from './top-header.component';
import { ToastHostComponent } from '../shared/ui/toast-host.component';

/** Persistent chrome: sidebar + header stay mounted, only the outlet swaps. */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SidebarComponent, TopHeaderComponent, ToastHostComponent],
  template: `
    <div class="flex h-screen overflow-hidden" style="background: var(--bg);">
      <app-sidebar [open]="navOpen()" (close)="navOpen.set(false)" />

      <div class="flex min-w-0 flex-1 flex-col">
        <app-top-header (toggleNav)="navOpen.set(!navOpen())" />
        <main class="flex-1 overflow-y-auto">
          <router-outlet />
        </main>
      </div>
    </div>

    <app-toast-host />
  `,
})
export class AppShellComponent {
  protected readonly navOpen = signal(false);
}
