# UI design rules

Angular 18 specifics, pulled out of `CLAUDE.md` for quick reference while
actually editing a component. These are all things that compile fine and fail
silently or at runtime, so they don't show up as build errors.

## Angular 18 gotchas

- **`standalone: true` is required on every component.** It only became the
  default in v19 — omitting it here is a real bug, not just style, since this
  app is on v18.
- **`@else if` does not support the `as` alias** that `@if` supports. Nest the
  block instead of chaining; the compiler error points at the block body, not
  at the alias, so it's easy to misdiagnose.
- **Backticks inside a component template are a TS template-literal
  terminator.** Never put them in template comments — the file will fail to
  compile with a confusing error far from the actual backtick.
- **`zone.js` is required in polyfills.** The app is not zoneless; don't remove
  it "for performance" without checking every effect/signal path still fires.
- **Writing a signal inside `effect()` throws `NG0600`** unless
  `{ allowSignalWrites: true }` is passed. This became the default (and the
  option was removed) in v19, so a snippet written against a newer Angular
  version will compile here and then fail silently at runtime — the effect just
  throws and the feature does nothing, with no build error. This exact bug left
  every page empty until the user pressed Refresh; regression coverage lives in
  `policy-state.service.spec.ts` — don't delete it.

## Styling

- Tailwind 4, configured via `.postcssrc.json` (not a `tailwind.config.js`
  content-scanning setup).
- Manrope is the only font — one `--font-sans` token. Don't introduce a second
  font family or hardcode a font name in a component's styles.

## State

- `PolicyStateService` owns all list state (filters, pagination, active
  selections). Components read its signals and call intent methods.
- No component issues its own HTTP request, except the AI components (Policy
  Copilot chat, streaming), which own their own request lifecycle because of
  SSE.
- Model output renders only through Angular property bindings
  (`markdown-text.component.ts`), never `innerHTML` — it's untrusted text.
