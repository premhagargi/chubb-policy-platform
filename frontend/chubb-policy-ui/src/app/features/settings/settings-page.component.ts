import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemeService, ThemePreference } from '../../core/services/theme.service';
import { IconComponent } from '../../shared/ui/icon.component';

@Component({
  standalone: true,
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="mx-auto max-w-3xl p-4 lg:p-6">
      <header class="mb-5">
        <h1 class="text-[22px] font-semibold tracking-tight" style="color: var(--text);">
          Settings
        </h1>
        <p class="mt-0.5 text-[13px]" style="color: var(--text-muted);">
          Workspace preferences for this device
        </p>
      </header>

      <section class="surface-card p-5">
        <h2 class="text-[15px] font-semibold" style="color: var(--text);">Appearance</h2>
        <p class="mt-0.5 text-[13px]" style="color: var(--text-muted);">
          Choose how the platform looks. System follows your operating system setting.
        </p>

        <div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          @for (option of options; track option.value) {
            <button
              type="button"
              class="flex items-center gap-2.5 rounded-lg border px-3.5 py-3 text-left transition-colors"
              [style.border-color]="
                theme.preference() === option.value ? 'var(--brand)' : 'var(--border)'
              "
              [style.background]="
                theme.preference() === option.value
                  ? 'color-mix(in srgb, var(--brand) 5%, var(--surface))'
                  : 'var(--surface)'
              "
              (click)="theme.setPreference(option.value)"
              [attr.aria-pressed]="theme.preference() === option.value"
            >
              <span
                [style.color]="
                  theme.preference() === option.value ? 'var(--brand)' : 'var(--text-muted)'
                "
              >
                <app-icon [name]="option.icon" [size]="17" />
              </span>
              <span class="text-[13px] font-medium" style="color: var(--text);">{{
                option.label
              }}</span>
            </button>
          }
        </div>
      </section>

      <section class="surface-card mt-4 p-5">
        <h2 class="text-[15px] font-semibold" style="color: var(--text);">Account</h2>
        <dl class="mt-3 space-y-2.5">
          <div class="flex items-baseline justify-between gap-4">
            <dt class="text-[13px]" style="color: var(--text-muted);">Name</dt>
            <dd class="text-[13px] font-medium" style="color: var(--text);">Prem</dd>
          </div>
          <div class="flex items-baseline justify-between gap-4">
            <dt class="text-[13px]" style="color: var(--text-muted);">Role</dt>
            <dd class="text-[13px] font-medium" style="color: var(--text);">Administrator</dd>
          </div>
          <div class="flex items-baseline justify-between gap-4">
            <dt class="text-[13px]" style="color: var(--text-muted);">Region</dt>
            <dd class="text-[13px] font-medium" style="color: var(--text);">APAC</dd>
          </div>
        </dl>
        <p class="mt-3.5 text-xs" style="color: var(--text-subtle);">
          Authentication is not enabled in this environment — profile details are static.
        </p>
      </section>
    </div>
  `,
})
export class SettingsPageComponent {
  protected readonly theme = inject(ThemeService);

  protected readonly options: {
    value: ThemePreference;
    label: string;
    icon: 'sun' | 'moon' | 'settings';
  }[] = [
    { value: 'light', label: 'Light', icon: 'sun' },
    { value: 'dark', label: 'Dark', icon: 'moon' },
    { value: 'system', label: 'System', icon: 'settings' },
  ];
}
