# Refactor Audit: eslint-config

## Package responsibility

`@ts-linq/eslint-config` (`packages/eslint-config`) is a shared ESLint 9 flat-config factory.
Its single export, `createNodeConfig(options)` (`index.mjs:157`), assembles ignores,
typescript-eslint type-checked rules, import sorting, prettier, naming conventions, and
per-file-type overrides (src vs test vs plain JS). Every package consumes it for linting.

## Current architectural problems

- **Type-safety rules globally disabled, hiding real bugs.** The `typescriptRules` block turns
  off the entire `no-unsafe-*` family at base level (`index.mjs:60-64`) and only re-enables
  them as `warn` for `src` (`:120-126`) and `test` (`:134-138`). `warn` does not fail CI, so
  `no-unsafe-assignment/call/member-access/return/argument` never block a merge anywhere.
- **`no-misused-promises` is off in tests** (`:140`), which masks the most common async test
  bug: a floating/unawaited promise inside `it(...)` that makes assertions silently not run.
- **`no-unnecessary-type-assertion` is off globally** (`:58`), so dead `as` casts (a frequent
  source of masked type errors after refactors) are never flagged.
- **A wide set of correctness rules permanently off**: `no-base-to-string`,
  `no-unsafe-enum-comparison`, `no-redundant-type-constituents`, `unbound-method`,
  `restrict-template-expressions`, `no-unsafe-function-type` (`:65-75`) — several of these
  catch genuine runtime bugs (stringifying objects, comparing mismatched enums, `this`-loss).
- **Hard-coded test globs include `tests-new`** (`:208`) — couples the shared config to one
  package's idiosyncratic directory name (see integration-tests/task-4).
- **`ban-ts-comment` allows `ts-ignore: true`** (`:80`) — `@ts-ignore` (the unsafe, no-reason
  variant) is permitted, undermining the otherwise-strict TS-comment policy.
- **No flat-config self-lint / type for `options`.** The factory is plain JS with JSDoc only;
  there is no compile-time guarantee that `createNodeConfig` is called correctly.

## Refactor goals

- Promote the highest-value correctness rules from `off`/`warn` to `error` (at least in src),
  with a documented, time-boxed migration path for existing violations.
- Re-enable `no-misused-promises` for tests (or scope the relaxation precisely).
- Decouple the shared config from package-specific directory names.
- Tighten `ban-ts-comment` to forbid bare `@ts-ignore`.

## Recommended task order

| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-1.md — Promote bug-hiding rules from off/warn to error | P1 | `no-unsafe-*`/`no-misused-promises` never block CI |
| 2 | task-2.md — Decouple shared config from package-specific globs + tighten ts-comment | P2 | `tests-new` coupling, `ts-ignore` allowed |

## Dependencies on other packages

- Consumed by every package's local eslint config via `createNodeConfig`.
- The `tests-new` glob ties it to `@ts-linq/integration-tests` (rename coordinated in
  integration-tests/task-4).
- No runtime dependency on other workspace packages (pure dev tooling).

## Testing strategy

- Add a fixture-based self-test: a small set of `.ts` files exercising each promoted rule,
  asserting the config reports the expected error/warn. This guards against silent rule
  regressions when the factory changes.
- Run `pnpm lint` repo-wide after each promotion to size the violation backlog before
  flipping `warn` → `error`.

## Notes

- The flat-config structure itself is sound (correct block ordering: ignores → recommended →
  main → src override → test override → prettier-last → JS disableTypeChecked). The findings
  are about rule *severity policy*, not config correctness.
- `index.mjs:171` uses `recommendedTypeChecked` — good; the gap is the manual overrides that
  neutralise it.
