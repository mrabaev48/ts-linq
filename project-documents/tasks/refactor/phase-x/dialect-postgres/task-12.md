---
status: not-started
phase: phase-x
package: dialect-postgres
priority: P3
effort: S
risk: low
category: clean-code
depends_on: ['dialect-postgres/task-7.md']
related: ['dialect-postgres/task-1.md', 'dialect-postgres/task-3.md']
---

# Refactor: Inject the quoter into `AbstractDdlStrategy` (DDL quoting Strategy)

## Problem
`AbstractDdlStrategy` (task-7) declares `quoteIdentifier`/`quoteStringLiteral` as abstract protected
methods, and each concrete dialect implements them by delegating to its per-package `quoting.ts`
module functions (a direct import). This mirrors the interim state task-3 left and the injection
task-1 deferred for the SELECT/CRUD base (`DialectSyntax.quote`): quoting is wired by inheritance +
module import rather than injected as a strategy object.

## Evidence
- `packages/dialect-kit/src/ddl/AbstractDdlStrategy.ts` — `protected abstract quoteIdentifier(...)` /
  `quoteStringLiteral(...)`.
- `packages/dialect-*/src/*DdlStrategy.ts` — each concrete implements them by delegating to
  `import { quoteIdentifier, quoteStringLiteral } from './quoting'`.
- task-1's `DialectSyntax` already models `quote`/`quoteStringLiteral` as an injected strategy for the
  DML base; the DDL base does not reuse it.

## Why this is bad
- Two mechanisms for the same concern (quoting) across the two base classes: injected `DialectSyntax`
  for DML, abstract-method-per-dialect for DDL.
- A dialect's quoting cannot be swapped/tested in isolation without subclassing.

## Target architecture
- Introduce a small DDL quoting strategy (or reuse task-1's `DialectSyntax` `quote`/
  `quoteStringLiteral`) and inject it into `AbstractDdlStrategy` via the constructor, so concrete
  strategies pass a quoter instead of overriding two methods.
- Removes the per-dialect quote-method boilerplate; unifies the quoting-injection story across the
  DML and DDL bases.

## Acceptance criteria
- [ ] `AbstractDdlStrategy` receives its quoter by injection; the abstract quote methods are gone.
- [ ] Concrete strategies no longer override `quoteIdentifier`/`quoteStringLiteral`.
- [ ] No SQL/DDL output change (contract harness + `*DdlStrategy` tests byte-identical).
- [ ] `pnpm typecheck`, `pnpm tests:unit`, `pnpm build`, `arch:*` pass.

## Notes
Low-priority polish deferred from task-7 (which kept the task-3 direct-import wiring to bound blast
radius). Best landed alongside or after task-1 so the DML and DDL bases share one quoting-injection
model.
