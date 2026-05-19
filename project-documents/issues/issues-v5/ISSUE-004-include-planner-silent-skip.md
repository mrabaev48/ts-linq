# ISSUE-004: `IncludePlanner.loadLevel()` silently skips unknown navigation properties

## Severity

Medium

## Category

- Public API
- Testability
- Clean Code

## Location

- `packages/query/src/IncludePlanner.ts:46-54` — recursive `loadLevel`
- Indirect callers: `Queryable.include` / `Queryable.thenInclude` (PR #66, ~`packages/query/src/Queryable.ts`)

## Problem

`loadLevel` resolves each requested include path segment against metadata; when the relationship is not found, the iteration just continues:

```ts
const metadata = MetadataStorage.getEntity(entityClass as new () => unknown);
for (const [propName, nestedPaths] of byFirst) {
  if (nestedPaths.length === 0) continue;
  const rel = metadata?.relationships.find((r) => r.propertyName === propName);
  if (!rel) continue;        // <-- silent skip
  const targetCtor = resolveTargetCtor(rel.targetEntity);
  if (!targetCtor) continue; // <-- silent skip
  ...
}
```

Three classes of user error are masked:

1. **Typo in include path**: `.include('postss')` — silently produces an entity with no `posts`.
2. **Wrong lambda selector**: `.include(b => b.posts).thenInclude(p => p.athor)` — `athor` typo, no error.
3. **Configuration drift**: a relationship was removed from the entity but include calls were not updated — old code keeps "working" with missing data.

Note that the *first-level* include is delegated to `entityLoader.populateRelationshipsMany`, which may itself tolerate missing relationships; the silent-skip pattern here applies specifically to **nested** include levels (the `thenInclude` chain introduced by PR #66).

Additionally, `metadata` is `undefined` when the entity has no decorator metadata registered — the optional chain (`metadata?.relationships.find(...)`) masks this. The user gets an empty result instead of a "this entity has no metadata; did you forget `@Entity`?" error.

## Evidence

- `packages/query/src/IncludePlanner.ts:46` — `MetadataStorage.getEntity(...)` returns `undefined` for unregistered entities; the optional chain hides that case.
- `packages/query/src/IncludePlanner.ts:51-54` — two `continue` statements that swallow distinct error classes.
- No log call, no warning emitted from `populateIncludes` or `loadLevel`.
- The first-level path (line 35-43) passes `includes: topLevelKeys` to `entityLoader.populateRelationshipsMany`, which may have its own silent behaviour for typos — out of scope here but worth checking.

## Why It Matters

- **Correctness risk**: An ORM whose eager loader silently returns incomplete graphs cannot be trusted. Users will produce features against the assumption that `include` works, then ship and discover gaps only when the missing field is observed downstream.
- **Debuggability**: There is no log, no telemetry event, no failed assertion — only "the page renders but `post.comments` is undefined".
- **Test ergonomics**: Tests that pass a wrong selector cannot fail; the design actively discourages selector-correctness tests.

## Recommended Fix

1. Throw a typed error from `loadLevel` when:
   - `metadata` is `undefined` (unregistered entity), OR
   - the requested `propName` does not exist on the entity class at all (compare against `Reflect.ownKeys(new entityClass())` or a metadata-resident "navigation property names" list), OR
   - the relationship exists but `resolveTargetCtor()` cannot resolve the target.

2. Provide a single error class — e.g. `IncludeResolutionError extends Error` — carrying `{ entityClass, propertyPath, reason }`. Document it as a thrown error in the JSDoc of `populateIncludes`, `Queryable.include`, and `Queryable.thenInclude`.

3. Keep a `silent` opt-out only if there is a documented reason — e.g. `populateIncludes(entities, includes, { onMissing: 'warn' | 'throw' | 'ignore' })`. Default to `'throw'`.

4. Mirror the validation at compile time where possible: the existing `extractKey` returns a `string`; if the path is statically known (literal lambdas) the AST transformer could pre-validate against `MetadataStorage` at build time.

## Acceptance Criteria

- `.include('typo')` throws `IncludeResolutionError` with `propertyPath: 'typo'` and a clear message naming the entity.
- `.include(b => b.posts).thenInclude(p => p.author_typo)` throws at the `thenInclude` resolution step.
- Unit test in `packages/query/tests/IncludePlanner.test.ts` covers each branch (typo, missing metadata, unresolvable target).
- JSDoc on `populateIncludes` / `include` / `thenInclude` documents the throw.
- `pnpm typecheck && pnpm test:unit` green.
