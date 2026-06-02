# Refactor Audit: plugin-soft-delete

## Package responsibility

`@ts-linq/plugin-soft-delete` is meant to convert deletes into flag/timestamp updates and filter
deleted rows from queries. It exposes `SoftDeleteMiddleware` (imperative methods), `SoftDeleteContext`,
an `ISoftDeleteMiddleware` interface, and helpers (`withSoftDelete`, `restore`, `isSoftDeleted`,
`markForHardDelete`, `isMarkedForHardDelete`).

## Current architectural problems

1. **Entirely superseded by an in-tree implementation.** `@ts-linq/orm` already has a *wired*
   `SoftDeleteInterceptor` (`packages/orm/src/services/SoftDeleteInterceptor.ts`) driven through
   `DbContext` (`DbContext.ts:143,186-199`) and `DeleteCommand` (`commands/DeleteCommand.ts:24`). This
   plugin is a dead parallel copy.
2. **Orphaned / unwired:** `handleSoftDelete` and `getFilterCondition` are called by nothing outside
   the plugin's own tests; no package depends on the plugin.
3. **Raw, dialect-coupled SQL string** in `getFilterCondition` (`SoftDeleteMiddleware.ts:96-100`):
   `= 0 OR ... IS NULL` assumes a specific boolean encoding and bypasses the provider.
4. **Magic-string side channel** `__hardDelete` written onto entities (`utils.ts:49-59`) — an untyped
   stringly-typed protocol attached to user objects.
5. **In-place entity mutation** in `handleSoftDelete` (lines 54-67) with no contract.
6. **Divergent `SoftDeleteOptions`** from `@ts-linq/types` (see `_shared/task-5`): adds `type` and
   `filterDeleted` the real interceptor ignores.
7. **Same-name interface vs class**, **broken ESM build**, **dead `tests-new/`** (see `_shared`).

## Refactor goals

- Collapse to a single soft-delete implementation (the orm interceptor) — retire or fold the plugin.
- Remove raw SQL and the `__hardDelete` magic string.
- Reconcile the option type with `@ts-linq/types`.

## Recommended task order

| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-1.md Retire/fold the duplicate of the orm SoftDeleteInterceptor | P0 | Two implementations of one feature, only one wired |
| 2 | task-4.md Remove raw/dialect-coupled SQL from `getFilterCondition` | P1 | Bypasses provider; `= 0` boolean assumption |
| 3 | task-2.md Replace `__hardDelete` magic-string side channel | P1 | Untyped stringly protocol on user entities |
| 4 | task-5.md Entity mutation contract | P1 | In-place flag writes without contract |
| 5 | task-3.md Reconcile `SoftDeleteOptions` (see `_shared/task-5`) | P2 | Two diverging types |

## Dependencies on other packages

- `@ts-linq/orm` — owns the real `SoftDeleteInterceptor` this plugin duplicates.
- `@ts-linq/types` — owns the canonical `SoftDeleteOptions`.
- `@ts-linq/metadata` — column probe.

## Testing strategy

- Contract test: plugin and orm interceptor must not produce divergent behaviour (or the plugin is removed).
- SQL safety: filter predicate is parameterized/dialect-correct.
- Hard-delete bypass: explicit, typed, tested (no magic string).

## Notes

Of the three plugins this is the strongest retire candidate: the feature already exists, wired and
tested, inside `@ts-linq/orm`. The plugin is almost pure duplication.
