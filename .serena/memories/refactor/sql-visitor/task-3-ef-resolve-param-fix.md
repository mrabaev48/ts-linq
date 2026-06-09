# refactor sql-visitor/task-3 — fix EF property-as-value binding

**Status:** ✅ Completed (branch `audit-refactor/sql-visitor-ef-resolve-param-fix`).
**Changeset:** `@ts-linq/sql-visitor` **patch** (`.changeset/sql-visitor-ef-resolve-param-fix.md`).

## Bug confirmed and fixed
`EfFunctionVisitor.resolveParam`'s `PropertyNode`-in-value-position branch
(`packages/sql-visitor/src/visitors/EfFunctionVisitor.ts`) previously did:

```ts
return [placeholder, renderPropertyName(arg, undefined)];
```

i.e. it emitted a placeholder (`?`/`$N`) and bound the **column-name string** as the parameter
value, and passed `resolver = undefined` (dropping `@Column({ name })` mapping). So
`EF.functions.dateDiffDay(a.start, a.end)` would have compared against the literal string
`"end"` rather than the `end` column.

## What changed
- A property in a value position is now **inlined as a resolved column reference**
  (`renderPropertyName(arg, resolver)`, no placeholder, no bound parameter) — matching the
  already-correct `resolveVariadicArgs`.
- **DRY:** extracted a private `renderArg(arg, inputParameters, resolver, state):
  { sql: string; parameters: SqlParameter[] }` helper — the single source of truth for the
  property/literal/parameterRef branches. Returns `parameters: []` for property,
  `[value]` for literal/parameterRef. (Array, not `param?`, to cleanly distinguish "no param"
  from a literal whose value is `null`/`undefined`.)
- `resolveParam` is now a thin wrapper keeping the `undefined`-arg guard, delegating to
  `renderArg`; return shape changed from `[placeholder, value]` to `{ sql, parameters }`.
- `resolveVariadicArgs` rewritten to loop over `renderArg`.
- All four single-value callers (`like`, `iLike`, `dateDiffDay`, `dateDiffMonth`) updated to the
  new return shape and now thread `resolver` (never `undefined` where available).

## resolver threading
Confirmed: every `renderPropertyName` call inside `EfFunctionVisitor` (via `resolveCol`,
`renderArg`) receives the `VisitContext.resolver`. No `undefined` resolver where one is available.

## Tests (`packages/sql-visitor/tests/EfFunctionVisitor.test.ts`)
- New: `dateDiffDay(prop('start'), prop('end'))` with a column resolver → `parameters === []`,
  condition contains resolver-mapped names, no `?`/`$1`.
- New: `like(prop('name'), literal '%x%')` → still `name LIKE ?` with `parameters: ['%x%']`
  (literal regression).
- All pre-existing EF tests pass unchanged (32 total green).

## Production reachability
Bug was **unreachable in production** — the EF visitor is not yet wired into `.where()` (pending
`query/task-4`). Fix is a pre-emptive guard against a latent defect shipping when task-4 lands.

## Validation outcomes
typecheck ✓ · lint ✓ (0 errors) · build ✓ · test:unit ✓ (3046) · test:integration ✓ (464) ·
test:e2e ✓ (290) · arch:deps ✓ · arch:cycles ✓ · arch:dead ✓ · sql-visitor tsd ✓.

## Package status after task-3
`sql-visitor` remains 🔄 In Progress — tasks 1, 2, 3, 4 ✅; **task-5** (JSON rewrite gap in
isNull/method) still pending.
