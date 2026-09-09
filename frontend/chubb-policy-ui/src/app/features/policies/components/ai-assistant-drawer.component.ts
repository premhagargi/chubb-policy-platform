import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { toAiScope } from '../../../core/models/ai.model';
import { PolicyFilter } from '../../../core/models/policy-filter.model';
import { AiService } from '../../../core/services/ai.service';
import { IconComponent } from '../../../shared/ui/icon.component';
import { MarkdownTextComponent } from '../../../shared/ui/markdown-text.component';

interface Turn {
  role: 'user' | 'assistant' | 'flag-action';
  text: string;
  /** Set once the answer finishes, for the provenance line under it. */
  meta?: string;
  failed?: boolean;
  /** Flag-action specific fields. */
  flagPolicyIds?: string[];
  flagPolicyLabel?: string;
  flagStatus?: 'pending' | 'confirming' | 'in-flight' | 'done' | 'dismissed';
}

/**
 * Policy Copilot — the end-to-end prompt flow, as a right-hand assistant panel.
 *
 * Every question carries the caller's *current filter* as scope, so answers
 * describe the set on screen rather than the whole book; the header states which
 * scope is in effect so the user can see what an answer covered.
 *
 * Answers arrive token by token over SSE, which is why the busy state has two
 * phases: pulsating dots while the model is still thinking, then live text with a
 * caret as tokens land. Non-modal by design - an assistant beside the data is
 * more useful than one that blocks it, so there is no scrim and no focus trap.
 *
 * Flagging tool-use: when the AI mentions a policy that should be flagged, or when
 * the user explicitly asks to flag a policy, the copilot shows an inline action
 * card with confirm/dismiss buttons. After confirmation, it calls the flagRequest
 * output so the parent page can trigger the actual mutation via PolicyStateService.
 * A tick mark and success message appear once the flag is complete.
 */
@Component({
  standalone: true,
  selector: 'app-ai-assistant-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent, MarkdownTextComponent],
  host: { '(document:keydown.escape)': 'close.emit()' },
  template: `
    @if (open()) {
      <aside
        class="animate-drawer-in fixed bottom-4 right-4 top-4 z-50 flex w-[calc(100vw-2rem)] max-w-[350px] flex-col overflow-hidden rounded-xl shadow-2xl"
        style="background: var(--surface); border: 1px solid var(--border);"
        role="complementary"
        aria-label="Policy Copilot assistant"
      >
        <!-- Header -->
        <header
          class="flex shrink-0 items-center gap-2 px-3 py-2"
          style="border-bottom: 1px solid var(--border);"
        >
          <span class="flex items-center" style="color: var(--accent);">
            <app-icon name="sparkle" [size]="17" />
          </span>

          <h2 class="min-w-0 flex-1 text-[14px] font-semibold tracking-tight" style="color: var(--text);">
            Policy Copilot
          </h2>

          @if (turns().length > 0) {
            <button
              type="button"
              class="rounded-md px-2 py-1 text-[11px] font-medium transition-colors hover:bg-[var(--surface-hover)]"
              style="color: var(--text-muted);"
              (click)="clear()"
            >
              Clear
            </button>
          }

          <button
            type="button"
            class="rounded-md p-1.5 transition-colors hover:bg-[var(--surface-hover)]"
            style="color: var(--text-muted);"
            (click)="close.emit()"
            aria-label="Close assistant"
          >
            <app-icon name="close" [size]="18" />
          </button>
        </header>

        <!-- Conversation -->
        <div #thread class="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
          @if (turns().length === 0) {
            <div class="flex h-full flex-col items-center justify-center text-center">
              <span
                class="flex h-11 w-11 items-center justify-center rounded-full"
                style="background: var(--surface-hover); color: var(--text-subtle);"
              >
                <app-icon name="sparkle" [size]="22" />
              </span>
              <h3 class="mt-3.5 text-[14px] font-semibold" style="color: var(--text);">
                Ask about these policies
              </h3>
              <p class="mt-1 max-w-[260px] text-[13px]" style="color: var(--text-muted);">
                Answers are grounded in the {{ scopeLabel() }} currently in view.
              </p>
            </div>
          } @else {
            <div class="space-y-3.5">
              @for (turn of turns(); track $index) {
                @if (turn.role === 'user') {
                  <div class="flex justify-end">
                    <p
                      class="max-w-[85%] rounded-lg rounded-br-sm px-3 py-2 text-[13px] leading-relaxed"
                      style="background: var(--brand); color: var(--brand-contrast);"
                    >
                      {{ turn.text }}
                    </p>
                  </div>
                } @else if (turn.role === 'flag-action') {
                  <!-- Flag action card -->
                  <div class="rounded-lg border px-3 py-2.5" style="border-color: var(--border); background: var(--surface);">
                    @if (turn.flagStatus === 'pending' || turn.flagStatus === 'confirming') {
                      <!-- Pre-confirmation state -->
                      <div class="flex items-start gap-2.5">
                        <span
                          class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                          style="background: var(--flag-bg); color: var(--flag);"
                        >
                          <app-icon name="flag" [size]="13" />
                        </span>
                        <div class="min-w-0 flex-1">
                          <p class="text-[13px] font-medium" style="color: var(--text);">
                            Flag {{ turn.flagPolicyLabel }}
                          </p>
                          <p class="mt-0.5 text-[11px]" style="color: var(--text-muted);">
                            This will flag the policy for review by the operations team.
                          </p>
                          <div class="mt-2 flex gap-2">
                            <button
                              type="button"
                              class="flex h-7 items-center gap-1 rounded-md px-2.5 text-[12px] font-medium transition-opacity hover:opacity-90"
                              style="background: var(--brand); color: var(--brand-contrast);"
                              [disabled]="flagInFlight()"
                              (click)="confirmFlag($index)"
                            >
                              <app-icon name="flag" [size]="12" />
                              {{ turn.flagStatus === 'confirming' ? 'Confirm flag' : 'Flag policy' }}
                            </button>
                            <button
                              type="button"
                              class="flex h-7 items-center rounded-md border px-2.5 text-[12px] font-medium transition-colors hover:bg-[var(--surface-hover)]"
                              style="border-color: var(--border); color: var(--text-muted);"
                              (click)="dismissFlag($index)"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      </div>
                    } @else if (turn.flagStatus === 'in-flight') {
                      <!-- In-progress state -->
                      <div class="flex items-center gap-2.5">
                        <svg class="h-4 w-4 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="color: var(--text-muted);">
                          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" opacity="0.25" />
                          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
                        </svg>
                        <p class="text-[13px]" style="color: var(--text-muted);">
                          Flagging {{ turn.flagPolicyLabel }}…
                        </p>
                      </div>
                    } @else if (turn.flagStatus === 'done') {
                      <!-- Success state -->
                      <div class="flex items-center gap-2.5">
                        <span
                          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                          style="background: #e8f5e9; color: #2e7d32;"
                        >
                          <app-icon name="check" [size]="14" />
                        </span>
                        <div class="min-w-0 flex-1">
                          <p class="text-[13px] font-medium" style="color: var(--text);">
                            {{ turn.flagPolicyLabel }} flagged
                          </p>
                          <p class="mt-0.5 text-[11px]" style="color: var(--text-muted);">
                            Flagged for review · visible to the operations team
                          </p>
                        </div>
                      </div>
                    } @else if (turn.flagStatus === 'dismissed') {
                      <!-- Dismissed state -->
                      <div class="flex items-center gap-2 opacity-60">
                        <app-icon name="close" [size]="14" />
                        <p class="text-[12px]" style="color: var(--text-muted);">
                          Flag action dismissed
                        </p>
                      </div>
                    }
                  </div>
                } @else if (turn.text) {
                  <!-- Only once there is something to show: an assistant turn
                       starts empty, and rendering its bubble immediately left an
                       empty bar sitting above the thinking dots. -->
                  <div>
                    <div
                      class="rounded-lg rounded-bl-sm px-3 py-2 text-[13px] leading-relaxed"
                      [style.background]="turn.failed ? 'var(--accent-bg)' : 'var(--surface-hover)'"
                      [style.color]="turn.failed ? 'var(--accent)' : 'var(--text)'"
                    >
                      <app-markdown-text [value]="turn.text" />
                      @if ($last && streaming() && turn.text) {
                        <span class="caret" aria-hidden="true"></span>
                      }
                    </div>

                    @if (turn.meta) {
                      <p class="mt-1 px-1 text-[11px]" style="color: var(--text-subtle);">
                        {{ turn.meta }}
                      </p>
                    }
                  </div>
                }
              }

              @if (thinking()) {
                <div
                  class="inline-flex items-center gap-1.5 rounded-lg rounded-bl-sm px-3 py-2.5"
                  style="background: var(--surface-hover);"
                >
                  <span class="sr-only">Generating an answer</span>
                  @for (dot of [0, 1, 2]; track dot) {
                    <span
                      class="dot h-1.5 w-1.5 rounded-full"
                      style="background: var(--text-subtle);"
                      [style.animation-delay.ms]="dot * 160"
                      aria-hidden="true"
                    ></span>
                  }
                </div>
              }
            </div>
          }
        </div>

        <!-- Sticky composer -->
        <form
          class="shrink-0 px-3 py-3"
          style="background: var(--surface);"
          (ngSubmit)="submit()"
        >
          @if (!streaming() && turns().length === 0) {
            <div class="mb-2 flex flex-wrap gap-1.5">
              @for (suggestion of suggestions; track suggestion) {
                <button
                  type="button"
                  class="rounded-full border px-2.5 py-1 text-[11px] transition-colors hover:bg-[var(--surface-hover)]"
                  style="border-color: var(--border); color: var(--text-muted);"
                  (click)="ask(suggestion)"
                >
                  {{ suggestion }}
                </button>
              }
            </div>
          }

          <label class="sr-only" for="copilot-prompt">Ask a question about these policies</label>
          <div
            class="flex items-center gap-2 rounded-2xl border py-1.5 pl-3 pr-1.5 transition-colors focus-within:border-[var(--brand)]"
            style="background: var(--bg); border-color: var(--border);"
          >
            <textarea
              id="copilot-prompt"
              name="prompt"
              rows="1"
              class="max-h-28 min-h-8 flex-1 resize-none self-center bg-transparent py-1.5 text-[13px] leading-5 outline-none"
              style="color: var(--text);"
              placeholder="Ask a question…"
              maxlength="2000"
              [(ngModel)]="prompt"
              (keydown.enter)="onEnter($event)"
              (input)="autoGrow($event)"
            ></textarea>

            <button
              type="submit"
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-opacity hover:opacity-90 disabled:opacity-40"
              style="background: var(--brand); color: var(--brand-contrast);"
              [disabled]="!canSubmit()"
              [attr.aria-label]="streaming() ? 'Stop generating' : 'Send question'"
            >
              @if (streaming()) {
                <span class="h-2.5 w-2.5 rounded-[2px] bg-current" aria-hidden="true"></span>
              } @else {
                <app-icon name="send" [size]="15" />
              }
            </button>
          </div>

          <p class="mt-1.5 px-1 text-[11px]" style="color: var(--text-subtle);">
            Enter to send · Shift + Enter for a new line
          </p>
        </form>
      </aside>
    }
  `,
  styles: [
    `
      /* Caret shown while tokens are still arriving. */
      .caret {
        display: inline-block;
        width: 2px;
        height: 1em;
        margin-left: 1px;
        vertical-align: text-bottom;
        background: var(--accent);
        animation: caret-blink 1s step-end infinite;
      }

      @keyframes caret-blink {
        50% {
          opacity: 0;
        }
      }

      /* Pulsating "thinking" dots. */
      .dot {
        animation: dot-pulse 1.2s ease-in-out infinite;
      }

      @keyframes dot-pulse {
        0%,
        60%,
        100% {
          opacity: 0.25;
          transform: translateY(0);
        }
        30% {
          opacity: 1;
          transform: translateY(-2px);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .caret,
        .dot {
          animation: none;
        }
        .dot {
          opacity: 0.6;
        }
      }
    `,
  ],
})
export class AiAssistantDrawerComponent {
  private readonly ai = inject(AiService);

  readonly open = input(false);
  readonly filter = input.required<PolicyFilter>();

  /** IDs of policies already flagged — used to check post-flag state. */
  readonly flaggedIds = input<ReadonlySet<string>>(new Set());

  /** True while a flag mutation is in flight. */
  readonly flagInFlight = input(false);

  readonly close = output<void>();

  /** Emitted when the user confirms a flag action inside the copilot. The parent
   *  page wires this to PolicyStateService.flagPolicies(). */
  readonly flagRequest = output<string[]>();

  @ViewChild('thread') private thread?: ElementRef<HTMLElement>;

  protected prompt = '';
  protected readonly turns = signal<Turn[]>([]);
  protected readonly streaming = signal(false);

  /** Track which flag-action turn is currently in flight so we can update it
   *  when the parent reports completion. */
  private activeFlagTurnIndex: number | null = null;

  /** Request sent, no token rendered yet - the pulsating-dots phase. */
  protected readonly thinking = computed(() => {
    if (!this.streaming()) return false;
    const last = this.turns().at(-1);
    return last?.role === 'assistant' && last.text === '';
  });

  /** One per supported question type: summary, statistics, single-policy lookup. */
  protected readonly suggestions = [
    'Summarise this portfolio',
    'Top regions by premium',
    'Which policies need attention first?',
  ];

  protected readonly scopeLabel = computed(() => {
    const f = this.filter();
    const parts: string[] = [];
    if (f.status) parts.push(f.status.toLowerCase());
    if (f.lineOfBusiness) parts.push(f.lineOfBusiness);
    if (f.region) parts.push(f.region);
    if (f.flagged === true) parts.push('flagged');
    if (f.search) parts.push(`"${f.search}"`);
    return parts.length ? `${parts.join(' · ')} policies` : 'the whole portfolio';
  });

  private subscription: Subscription | null = null;

  protected canSubmit(): boolean {
    return this.streaming() || this.prompt.trim().length > 0;
  }

  /** Enter sends; Shift + Enter inserts a newline. */
  protected onEnter(event: Event): void {
    if ((event as KeyboardEvent).shiftKey) return;

    event.preventDefault();
    this.submit();
  }

  /** Grow the textarea with its content, up to the max-height set in the template. */
  protected autoGrow(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  protected submit(): void {
    // While a response is streaming the send button becomes a stop button.
    if (this.streaming()) {
      this.stop();
      return;
    }

    const question = this.prompt.trim();
    if (!question) return;

    this.prompt = '';
    this.ask(question);
  }

  protected ask(question: string): void {
    if (this.streaming()) return;

    // Check if this is an explicit flag request from the user.
    const flagIntent = this.parseFlagIntent(question);
    if (flagIntent) {
      this.handleFlagIntent(question, flagIntent);
      return;
    }

    this.turns.update((list) => [
      ...list,
      { role: 'user', text: question },
      { role: 'assistant', text: '' },
    ]);
    this.streaming.set(true);
    this.scrollToBottom();

    const startedAt = performance.now();

    this.subscription = this.ai.askStream(question, toAiScope(this.filter())).subscribe({
      next: (event) => {
        if (event.type === 'token') {
          this.appendToAnswer(event.value);
        } else if (event.type === 'error') {
          this.replaceAnswer(event.message, { failed: true });
        }
        this.scrollToBottom();
      },
      complete: () => {
        this.streaming.set(false);

        const last = this.turns().at(-1);
        if (last?.role === 'assistant' && !last.failed) {
          if (!last.text) {
            this.replaceAnswer('The assistant returned an empty answer.', { failed: true });
          } else {
            const elapsed = Math.round(performance.now() - startedAt);
            this.setMeta(`streamed · ${elapsed} ms`);

            // After a successful answer, check if the response suggests flagging.
            this.maybeOfferFlagFromAnswer(last.text);
          }
        }

        this.scrollToBottom();
      },
    });
  }

  protected stop(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
    this.streaming.set(false);

    const last = this.turns().at(-1);
    if (last?.role === 'assistant' && !last.text) {
      this.replaceAnswer('Stopped.', { failed: true });
    } else {
      this.setMeta('stopped');
    }
  }

  protected clear(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
    this.streaming.set(false);
    this.activeFlagTurnIndex = null;
    this.turns.set([]);
  }

  /** User clicked "Flag policy" on a flag-action card. */
  protected confirmFlag(turnIndex: number): void {
    const turn = this.turns()[turnIndex];
    if (!turn || turn.role !== 'flag-action' || !turn.flagPolicyIds?.length) return;

    // Check if already flagged.
    const alreadyFlagged = turn.flagPolicyIds.every((id) => this.flaggedIds().has(id));
    if (alreadyFlagged) {
      this.updateFlagTurn(turnIndex, {
        flagStatus: 'done',
        text: `${turn.flagPolicyLabel} is already flagged.`,
      });
      return;
    }

    this.activeFlagTurnIndex = turnIndex;
    this.updateFlagTurn(turnIndex, { flagStatus: 'in-flight' });
    this.flagRequest.emit(turn.flagPolicyIds);
    this.scrollToBottom();

    // Watch for flagInFlight to go from true -> false, meaning the mutation finished.
    this.waitForFlagCompletion(turnIndex);
  }

  /** User clicked "Dismiss" on a flag-action card. */
  protected dismissFlag(turnIndex: number): void {
    this.updateFlagTurn(turnIndex, { flagStatus: 'dismissed' });
    this.scrollToBottom();
  }

  /**
   * Called by the parent when flagInFlight changes. Since Angular signals
   * don't have a watch API from outside, we poll briefly.
   */
  private waitForFlagCompletion(turnIndex: number): void {
    const check = () => {
      if (!this.flagInFlight()) {
        this.updateFlagTurn(turnIndex, { flagStatus: 'done' });
        this.activeFlagTurnIndex = null;
        this.scrollToBottom();
      } else {
        setTimeout(check, 200);
      }
    };
    // Start checking after a short delay to let the mutation start.
    setTimeout(check, 300);
  }

  // --- flag intent handling ---

  /**
   * Detect if the user is asking to flag a policy by number or ID.
   * Returns the matched policy number/ID string, or null.
   */
  private parseFlagIntent(question: string): string | null {
    const lower = question.toLowerCase();
    // Match patterns like "flag PCL-100219" or "flag policy PCL-100219"
    const flagMatch = lower.match(/^(?:flag|mark|flag\s+policy|mark\s+policy)\s+([a-z0-9-]+)/i);
    if (flagMatch) return flagMatch[1].toUpperCase();
    return null;
  }

  /** Handle an explicit "flag <policy>" request. */
  private handleFlagIntent(question: string, policyRef: string): void {
    // Add user message.
    this.turns.update((list) => [
      ...list,
      { role: 'user', text: question },
      {
        role: 'flag-action' as const,
        text: '',
        flagPolicyIds: [policyRef],
        flagPolicyLabel: policyRef,
        flagStatus: 'confirming' as const,
      },
    ]);
    this.scrollToBottom();
  }

  /**
   * After a streamed answer completes, detect if the AI is recommending a flag
   * and offer a flag action card. Looks for patterns like "should be flagged"
   * or "recommend flagging" paired with a policy number.
   */
  private maybeOfferFlagFromAnswer(answerText: string): void {
    const flagPhrases = [
      'should be flagged',
      'recommend flagging',
      'flag this policy',
      'flag for review',
      'warrants review',
      'needs attention',
      'recommend marking for review',
      'suggest flagging',
    ];

    const lower = answerText.toLowerCase();
    const hasFlagSuggestion = flagPhrases.some((phrase) => lower.includes(phrase));
    if (!hasFlagSuggestion) return;

    // Try to extract policy numbers from the answer.
    const policyMatches = answerText.match(/\b(PCL-\d{4,})\b/gi);
    if (!policyMatches || policyMatches.length === 0) return;

    // Deduplicate and filter out already-flagged policies.
    const unique = [...new Set(policyMatches.map((m) => m.toUpperCase()))];
    const unflagged = unique.filter((id) => !this.flaggedIds().has(id));
    if (unflagged.length === 0) return;

    const label =
      unflagged.length === 1
        ? unflagged[0]
        : `${unflagged.length} policies`;

    this.turns.update((list) => [
      ...list,
      {
        role: 'flag-action',
        text: '',
        flagPolicyIds: unflagged,
        flagPolicyLabel: label,
        flagStatus: 'pending',
      },
    ]);
    this.scrollToBottom();
  }

  // --- internals ---

  private appendToAnswer(token: string): void {
    this.turns.update((list) => {
      const next = [...list];
      const last = next.at(-1);
      if (last?.role === 'assistant') next[next.length - 1] = { ...last, text: last.text + token };
      return next;
    });
  }

  private replaceAnswer(text: string, extra: Partial<Turn> = {}): void {
    this.turns.update((list) => {
      const next = [...list];
      const last = next.at(-1);
      if (last?.role === 'assistant') next[next.length - 1] = { ...last, text, ...extra };
      return next;
    });
  }

  private setMeta(meta: string): void {
    this.turns.update((list) => {
      const next = [...list];
      const last = next.at(-1);
      if (last?.role === 'assistant') next[next.length - 1] = { ...last, meta };
      return next;
    });
  }

  private updateFlagTurn(index: number, updates: Partial<Turn>): void {
    this.turns.update((list) => {
      const next = [...list];
      if (next[index]?.role === 'flag-action') {
        next[index] = { ...next[index], ...updates };
      }
      return next;
    });
  }

  private scrollToBottom(): void {
    // Wait for the DOM to reflect the signal change before measuring.
    queueMicrotask(() => {
      const element = this.thread?.nativeElement;
      if (element) element.scrollTop = element.scrollHeight;
    });
  }
}
