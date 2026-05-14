# ISSUE-017: `innerJoin` / `leftJoin` Predicate Variants Always Throw at Runtime

## Severity

Low

## Category

- Public API
- Documentation Drift

## Location

- `packages/query/src/Queryable.ts` — lines 222–251 (`innerJoin` with predicate, `leftJoin` with predicate)

## Problem

`Queryable<T>` exposes `innerJoin()` and `leftJoin()` overloads that accept arrow function predicates. These always throw a runtime error:

```typescript
// packages/query/src/Queryable.ts:228
throw new Error(
  "ts-linq(innerJoin): runtime predicate parsing is not supported. " +
  "Use the column-name string overload or ensure the compiler transformer is active."
);
```

Unlike `where()` and `select()` (documented as transformer-rewritten stubs — see ISSUE-003), these join methods explicitly state "runtime predicate parsing is not supported" — meaning they are not planned for transformer rewriting either. They exist only to present a consistent fluent API surface.

The string-overload variants `innerJoinOn()` and `leftJoinOn()` are the working alternatives, but they are separate methods rather than overloads on the same name.

## Evidence

```typescript
// packages/query/src/Queryable.ts
public innerJoin<TOther>(
  entity: new () => TOther,
  predicate: (left: T, right: TOther) => boolean  // ← always throws
): Queryable<T>;

public innerJoin<TOther>(
  entity: new () => TOther,
  leftKey: keyof T & string,
  rightKey: keyof TOther & string
): Queryable<T>;
```

The predicate overload signature appears in IntelliSense and is valid TypeScript, but calling it always results in a runtime exception.

## Why It Matters

- **API clarity**: Two overloads of the same method behave completely differently — one works, one always fails. This is a Principle of Least Surprise violation.
- **Documentation drift**: Unless the API documentation explicitly warns about the predicate overload, consumers will try it and get a runtime failure.
- **Relationship to ISSUE-003**: This is the same pattern as ISSUE-003 but applies to joins. The severity is lower because `innerJoinOn()` / `leftJoinOn()` provide a usable string-key alternative.

## Recommended Fix

**Option A — Remove the predicate overloads**:
- Keep only the string-key overloads (`innerJoinOn`, `leftJoinOn`) under unified names `innerJoin` and `leftJoin`
- Fewer overloads, clearer contract

**Option B — Mark predicate overloads as `@internal`**:
- Add `@internal` JSDoc to prevent the predicate signature from appearing in generated docs
- Add a `@throws` notice in JSDoc

**Option C — Implement predicate support**:
- If the two-column string join is the common case, the predicate form adds no value; skip it
- If complex join conditions are needed, implement a limited runtime expression evaluator for join predicates

Option A is simplest and clearest. If the predicate overload is intended for future transformer rewriting, it should be noted explicitly (as `where()` does).

## Acceptance Criteria

- Predicate overloads of `innerJoin` and `leftJoin` are either removed or explicitly marked as transformer-only stubs with the same treatment as `where()` (see ISSUE-003)
- The string-key join API is documented as the primary stable API for joins
- No method in the public API silently discards its overload signature without documentation
