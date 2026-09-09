import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The one spinner in the app, so every busy state looks the same.
 *
 * `currentColor` throughout: the spinner inherits the colour of whatever it sits
 * in (a brand button, muted body text), which is why it needs no variants.
 * `aria-hidden` because the surrounding control owns the announcement — a
 * standalone spinner announcing itself would duplicate the "Generating…" label
 * next to it.
 */
@Component({
  standalone: true,
  selector: 'app-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      class="animate-spin shrink-0"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" opacity="0.2" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
      />
    </svg>
  `,
})
export class SpinnerComponent {
  readonly size = input(16);
}
