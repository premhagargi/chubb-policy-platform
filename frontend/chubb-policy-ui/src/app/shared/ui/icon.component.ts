import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName =
  | 'dashboard'
  | 'policies'
  | 'flag'
  | 'analytics'
  | 'settings'
  | 'search'
  | 'filter'
  | 'close'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'arrow-up'
  | 'arrow-down'
  | 'refresh'
  | 'bell'
  | 'help'
  | 'download'
  | 'check'
  | 'alert'
  | 'inbox'
  | 'menu'
  | 'sun'
  | 'moon'
  | 'calendar'
  | 'clock';

/** One inline-SVG sprite so icon sizing and stroke weight stay identical everywhere.
 *  All paths are 24×24, 1.5 stroke, round caps — matching one consistent icon set. */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
      class="shrink-0"
    >
      @switch (name()) {
        @case ('dashboard') {
          <path d="M3 3h7v7H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 14h7v7H3z" />
        }
        @case ('policies') {
          <path d="M4 3h11l5 5v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
          <path d="M14 3v6h6M8 13h8M8 17h5" />
        }
        @case ('flag') {
          <path d="M4 21V4M4 4h11l-1.5 3.5L15 11H4" />
        }
        @case ('analytics') {
          <path d="M3 3v18h18" />
          <path d="M7 15l3.5-4 3 3L20 7" />
        }
        @case ('settings') {
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7.5l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.3z"
          />
        }
        @case ('search') {
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        }
        @case ('filter') {
          <path d="M3 5h18l-7 8v6l-4 2v-8z" />
        }
        @case ('close') {
          <path d="M18 6 6 18M6 6l12 12" />
        }
        @case ('chevron-left') {
          <path d="m15 18-6-6 6-6" />
        }
        @case ('chevron-right') {
          <path d="m9 18 6-6-6-6" />
        }
        @case ('chevron-down') {
          <path d="m6 9 6 6 6-6" />
        }
        @case ('arrow-up') {
          <path d="M12 19V5M5 12l7-7 7 7" />
        }
        @case ('arrow-down') {
          <path d="M12 5v14M19 12l-7 7-7-7" />
        }
        @case ('refresh') {
          <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
          <path d="M21 3v5h-5" />
        }
        @case ('bell') {
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        }
        @case ('help') {
          <circle cx="12" cy="12" r="9" />
          <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        }
        @case ('download') {
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="M7 10l5 5 5-5M12 15V3" />
        }
        @case ('check') {
          <path d="M20 6 9 17l-5-5" />
        }
        @case ('alert') {
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16h.01" />
        }
        @case ('inbox') {
          <path d="M22 12h-6l-2 3h-4l-2-3H2" />
          <path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z" />
        }
        @case ('menu') {
          <path d="M3 6h18M3 12h18M3 18h18" />
        }
        @case ('sun') {
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" />
        }
        @case ('moon') {
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        }
        @case ('calendar') {
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 11h18" />
        }
        @case ('clock') {
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        }
      }
    </svg>
  `,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input(16);
}
