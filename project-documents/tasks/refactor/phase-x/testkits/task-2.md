---
status: not-started
phase: phase-x
package: testkits
priority: P1
effort: L
risk: high
category: architecture
depends_on: []
related: ["testkits/task-3.md", "testkits/task-6.md"]
---

# Refactor: Decompose the `TestProvider` god class

## Problem

`packages/testkits/src/TestProvider.ts` is a single 632-LOC file that bundles at least five
distinct responsibilities: an embedded SQL `TestDialect`, an in-memory storage engine, a
hand-rolled regex SQL interpreter, a batch-statement codec, and the provider lifecycle/
transaction facade. It is consumed by 31+ integration test files and many unit suites, so it
is a high-fan-in hub whose behaviour silently defines what "passing" means for large swaths
of the suite.

## Evidence

- `packages/testkits/src/TestProvider.ts:22-138` — embedded `TestDialect` (SELECT/INSERT/
  UPDATE/DELETE + batch + bulk builders).
- `:174-176` — storage maps (`data`, `seq`) and a private `dialect` instance.
- `:420-570` — `doExecuteQuery`: regex parsing of `FROM`, `ORDER BY`, `WHERE`, `LIMIT`, plus
  two separate WHERE-evaluation passes (`:489-557`) that re-implement comparison operators.
- `:426-451` / `:572-607` — bespoke `BATCH_INSERT`/`BATCH_UPDATE`/`BATCH_DELETE` JSON codec
  embedded in the provider via `JSON.parse(sql.slice(...))`.
- `:453,457,462` — commented-out `console.log` debugging lines (dead code).
- `:613-631` — transaction methods are empty no-ops; `transaction()` just runs the action.

## Why this is bad

- **SRP violation**: a change to WHERE parsing, batch encoding, or transaction semantics all
  touch the same file, risking unrelated regressions across 31+ dependent suites.
- The regex SQL interpreter is a parallel, lower-fidelity SQL engine that drifts from real
  dialects; tests can pass here while failing against Postgres/MySQL/MSSQL.
- The class is effectively untestable in isolation — its collaborators are private and
  intertwined, so it is only exercised transitively.
- Two WHERE-evaluation passes (`:489-557`) duplicate operator logic and can disagree.

## Target architecture

Apply **SRP**, **composition-first**, and **dependency inversion**:

- `InMemoryStore` — pure storage: tables, sequences, CRUD by PK. No SQL knowledge.
- `SqlInterpreter` (or replace with a real embedded engine) — parses/evaluates the limited
  SQL surface; takes an `InMemoryStore`. Single WHERE evaluator.
- `BatchStatementCodec` — encode/decode the `BATCH_*` envelope used by `TestDialect`.
- `TestProvider` becomes a thin facade implementing the core `DatabaseProvider` contract by
  delegating to the above collaborators (constructor-injected, defaulted).

Strongly consider **replacing the regex interpreter with `better-sqlite3`/`sql.js`** so the
fake exercises real SQL semantics; the decomposition above makes that swap a single adapter
change (Open/Closed).

## Proposed refactor

1. Extract `InMemoryStore` (move `data`/`seq` + CRUD helpers).
2. Extract `SqlInterpreter` consuming `InMemoryStore`; collapse the two WHERE passes into one.
3. Extract `BatchStatementCodec`; `TestDialect` and the interpreter share it.
4. Reduce `TestProvider` to delegation; keep the public surface identical for callers.
5. Delete commented-out `console.log` lines.
6. (Optional, follow-up) Provide a `SqliteTestProvider` adapter as a higher-fidelity option.

## Suggested design patterns

- **Facade** — `TestProvider` over `InMemoryStore` + `SqlInterpreter`. WHY: preserves the
  public API for 31+ callers while internals are split.
- **Strategy / Adapter** — swap regex interpreter for a real sqlite engine without touching
  callers. WHY: kills SQL drift at the source.
- **Codec object** — `BatchStatementCodec`. WHY: removes `JSON.parse(sql.slice())` smell and
  centralises the batch envelope contract shared with `TestDialect`.

## Testing plan

- New focused unit tests for `InMemoryStore` (CRUD, sequence assignment) and `SqlInterpreter`
  (WHERE operators, ORDER BY, LIMIT/OFFSET, param binding) — currently only tested
  transitively.
- Characterization tests captured against the *current* `TestProvider` output before
  refactor, run after, to prove behavioural parity for dependent suites.

## Acceptance criteria

- [ ] `TestProvider.ts` reduced to a delegating facade (< ~150 LOC).
- [ ] `InMemoryStore`, `SqlInterpreter`, `BatchStatementCodec` extracted with own unit tests.
- [ ] Single WHERE evaluator (no duplicate operator logic).
- [ ] Commented-out debug logs removed.
- [ ] Public `TestProvider` API unchanged; all dependent suites still green.

## Refactor order

1. Characterization tests against current behaviour.
2. Extract `InMemoryStore`.
3. Extract `SqlInterpreter` (unify WHERE passes).
4. Extract `BatchStatementCodec`.
5. Slim the facade; remove dead code.

## Notes

- Coordinate with task-3 (unify provider interface) and task-6 (stub honesty) — all touch
  `TestProvider`.
