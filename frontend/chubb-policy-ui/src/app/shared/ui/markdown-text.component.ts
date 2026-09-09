import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type Segment = { text: string; bold: boolean; italic: boolean; code: boolean };

type Block =
  | { kind: 'paragraph'; lines: Segment[][] }
  | { kind: 'bullets'; items: Segment[][] }
  | { kind: 'numbers'; items: Segment[][] };

/**
 * Renders the constrained Markdown subset the AI prompts ask for: `-` bullets,
 * `1.` lists, `**bold**`, `*italic*` and `` `code` ``.
 *
 * Parsed into a structure and rendered through Angular's template bindings rather
 * than `innerHTML` + a sanitizer. Model output is untrusted text that can quote
 * policyholder-supplied names, so the safest thing is for markup to never exist:
 * there is no HTML string anywhere in this path for an injection to ride in on.
 * That also keeps the app free of a Markdown dependency it would otherwise carry
 * for five constructs.
 */
@Component({
  standalone: true,
  selector: 'app-markdown-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  template: `
    @for (block of blocks(); track $index) {
      @switch (block.kind) {
        @case ('bullets') {
          <ul class="my-1.5 space-y-1">
            @for (item of block.items; track $index) {
              <li class="flex gap-2">
                <span class="mt-[0.55em] h-1 w-1 shrink-0 rounded-full" style="background: currentColor; opacity: 0.45;"></span>
                <span class="min-w-0"><ng-container *ngTemplateOutlet="inline; context: { $implicit: item }" /></span>
              </li>
            }
          </ul>
        }
        @case ('numbers') {
          <ol class="my-1.5 space-y-1">
            @for (item of block.items; track $index; let i = $index) {
              <li class="flex gap-2">
                <span class="tabular shrink-0 opacity-60">{{ i + 1 }}.</span>
                <span class="min-w-0"><ng-container *ngTemplateOutlet="inline; context: { $implicit: item }" /></span>
              </li>
            }
          </ol>
        }
        @default {
          <p class="my-1.5 first:mt-0 last:mb-0">
            @for (line of block.lines; track $index; let last = $last) {
              <ng-container *ngTemplateOutlet="inline; context: { $implicit: line }" />
              @if (!last) {
                <br />
              }
            }
          </p>
        }
      }
    }

    <ng-template #inline let-segments>
      @for (segment of segments; track $index) {
        @if (segment.code) {
          <code
            class="rounded px-1 py-0.5 text-[0.92em]"
            style="background: color-mix(in srgb, currentColor 10%, transparent);"
            >{{ segment.text }}</code
          >
        } @else if (segment.bold) {
          <strong class="font-semibold">{{ segment.text }}</strong>
        } @else if (segment.italic) {
          <em>{{ segment.text }}</em>
        } @else {
          <span>{{ segment.text }}</span>
        }
      }
    </ng-template>
  `,
})
export class MarkdownTextComponent {
  readonly value = input('');

  protected readonly blocks = computed(() => parseBlocks(this.value()));
}

/** Groups lines into paragraphs and lists. */
function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  // Models occasionally wrap output in a fence despite instructions; drop the
  // fence markers rather than rendering them as literal text.
  const lines = source.replace(/^```[a-z]*\n?|\n?```$/g, '').split('\n');

  let paragraph: Segment[][] = [];
  let bullets: Segment[][] = [];
  let numbers: Segment[][] = [];

  const flush = (): void => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', lines: paragraph });
    if (bullets.length) blocks.push({ kind: 'bullets', items: bullets });
    if (numbers.length) blocks.push({ kind: 'numbers', items: numbers });
    paragraph = [];
    bullets = [];
    numbers = [];
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) {
      flush();
      continue;
    }

    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    if (bullet) {
      if (paragraph.length || numbers.length) flush();
      bullets.push(parseInline(bullet[1]));
      continue;
    }

    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      if (paragraph.length || bullets.length) flush();
      numbers.push(parseInline(numbered[1]));
      continue;
    }

    if (bullets.length || numbers.length) flush();
    // Strip any heading markers - the prompts ask for none, but a stray `##`
    // should render as its text rather than as literal hashes.
    paragraph.push(parseInline(line.replace(/^#{1,6}\s+/, '')));
  }

  flush();
  return blocks;
}

/** Splits one line into styled segments. */
function parseInline(text: string): Segment[] {
  const segments: Segment[] = [];
  // Order matters: `**bold**` must be tried before `*italic*`, or the italic
  // pattern would consume the first pair of asterisks.
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const push = (value: string, style: Partial<Segment> = {}): void => {
    if (!value) return;
    segments.push({ text: value, bold: false, italic: false, code: false, ...style });
  };

  while ((match = pattern.exec(text)) !== null) {
    push(text.slice(lastIndex, match.index));

    const token = match[0];
    if (token.startsWith('**') || token.startsWith('__')) {
      push(token.slice(2, -2), { bold: true });
    } else if (token.startsWith('`')) {
      push(token.slice(1, -1), { code: true });
    } else {
      push(token.slice(1, -1), { italic: true });
    }

    lastIndex = pattern.lastIndex;
  }

  push(text.slice(lastIndex));

  return segments.length ? segments : [{ text, bold: false, italic: false, code: false }];
}
