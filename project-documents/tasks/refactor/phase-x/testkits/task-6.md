---
status: not-started
phase: phase-x
package: testkits
priority: P2
effort: M
risk: medium
category: testing
depends_on: ["testkits/task-2.md"]
related: []
---

# Refactor: Remove lying stubs and harden the `TestProvider` SQL fallback

## Problem

Several `TestProvider` methods silently ignore their arguments and return wrong-but-passing
results, and the regex SQL evaluator has weak fallbacks that return `true` when it cannot
parse a condition. Tests written against these methods report green while exercising no real
filtering, which produces false confidence.

## Evidence

- `packages/testkits/src/TestProvider.ts:405-410` — `findWhere(entityClass, _where)` ignores
  `_where` and returns `findAll(entityClass)`. Comment: `// Stub behavior`.
- `:412-418` — `findWhereIn(entityClass, _column, _values)` likewise ignores its filter and
  returns `findAll`.
- `:499-501` — in the WHERE evaluator, `if (val === '?') return true;` — an unparsed
  parameter placeholder is treated as an unconditional match ("Weak fallback").
- `:524` and `:552` — the `every`/`switch` default paths `return true`, so any condition the
  regex cannot classify silently passes.
- `:267` — `update` falls back to `table.length - 1` (last row) when no PK match is found,
  so an update with a non-existent PK mutates an arbitrary row instead of being a no-op.

## Why this is bad

- A fake whose `findWhere` returns everything makes filtering tests pass without testing
  filtering — a false-green that hides real query/translation regressions.
- "Return `true` on parse failure" inverts the safe default: an undetectable condition should
  fail loudly (or the row should be excluded), not match.
- The `update` last-row fallback can produce data corruption that looks like success,
  masking PK-resolution bugs in higher layers.

## Why this is bad (catch-block audit)

No catch blocks; the defects are silent fallbacks and stub methods that mask failures —
equivalent in effect to a swallowed error.

## Target architecture

Apply **fail-fast** and **honest test doubles** (Clean Code: a fake must be faithful enough
to its contract that passing means something):

- After task-2 extracts `SqlInterpreter`, make unparseable conditions throw a clear
  `UnsupportedTestSqlError` (or exclude the row) rather than matching unconditionally.
- Implement `findWhere`/`findWhereIn` to actually filter via the store, or remove them if the
  real provider has no such methods (verify against the core contract).
- `update`/`delete` with no PK match should be a no-op returning 0 affected rows, never a
  silent mutation of an arbitrary row.

## Proposed refactor

1. Implement real filtering in `findWhere`/`findWhereIn`, or delete them if not on the
   provider contract (coordinate with task-3).
2. Replace the `return true` weak fallbacks in the WHERE evaluator with explicit
   throw/exclude behaviour.
3. Remove the `update` last-row fallback; require a genuine PK match.
4. Add a debug/strict mode that asserts every SQL string was fully consumed by the parser.

## Suggested design patterns

- **Fail-fast / Guard clauses** — throw on unsupported SQL instead of matching. WHY: turns
  silent false-greens into actionable failures.
- **Null Object / honest no-op** — no-match mutations affect 0 rows. WHY: faithful contract.

## Testing plan

- Tests proving `findWhere`/`findWhereIn` actually filter.
- Tests proving an unparseable WHERE throws (strict mode) or excludes rows.
- Tests proving update/delete with a non-existent PK affects 0 rows.

## Acceptance criteria

- [ ] No `// Stub behavior` methods that ignore filters.
- [ ] WHERE evaluator no longer returns `true` on parse failure.
- [ ] `update`/`delete` never mutate an arbitrary row on PK miss.
- [ ] New tests cover filtering, unsupported-SQL behaviour, and PK-miss no-ops.

## Refactor order

1. Land task-2 (extract interpreter) first.
2. Fix WHERE fallbacks.
3. Fix CRUD stubs/no-match semantics.
4. Add strict-mode assertion + tests.

## Notes

- Depends on task-2 so changes land in the extracted `SqlInterpreter`, not the monolith.
