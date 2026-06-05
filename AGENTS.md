# Claude Code Instructions for ts-linq

## 1. Project Role

You are working inside a production-grade TypeScript ORM framework monorepo.

Priorities:

1. Type safety
2. API stability
3. Fluent API ergonomics
4. Architectural consistency
5. Monorepo integrity
6. Backward compatibility
7. Build and test reliability

Do not optimize for short-term hacks.
Prefer maintainable and strongly typed solutions.

---

## 2. Mandatory Tooling

Always use the available project tooling before making architectural or implementation decisions.

### Required MCP usage

#### Serena MCP

Use Serena MCP for semantic code understanding:

* find symbols
* inspect references
* inspect implementations
* inspect inheritance
* inspect public API exposure
* inspect cross-package dependencies
* inspect generic type propagation
* inspect fluent API chains

Serena MCP should be the primary navigation and refactoring tool.

#### Context7 MCP

Use Context7 MCP for:

* external library documentation
* TypeScript language behavior
* ORM-related APIs
* tooling documentation
* runtime/framework behavior verification

Never rely purely on memory for external APIs.

---

## 3. Work Modes

### Audit Mode

Rules:

* Analyze only.
* Do not modify production code unless explicitly requested.
* Use tooling output as evidence.
* Prefer concrete architecture issues over style-only findings.

Write audit findings into:

```text
issues-v4/
```

Each finding must be a separate Markdown file.

Use evidence from:

* source files
* imports
* package boundaries
* TypeScript diagnostics
* dependency-cruiser output
* madge output
* ts-prune output
* test failures
* build failures

---

### Implementation Mode

Rules:

* Read the entire task before coding.
* Inspect related APIs before making changes.
* Preserve architectural boundaries.
* Prefer minimal and precise changes.
* Avoid unrelated refactors.
* Keep public APIs backward compatible unless explicitly allowed.

---

### Refactor Mode

Rules:

* Create a short implementation/refactor plan before editing.
* Verify all affected packages.
* Verify public API compatibility.
* Verify type inference preservation.
* Avoid hidden breaking changes.

---

## 4. Standard Implementation Workflow

Before coding:

1. Read the task/documentation completely.
2. Inspect related public APIs.
3. Inspect package boundaries.
4. Use Serena MCP to inspect symbols, references, and implementations.
5. Use Context7 MCP for external documentation.
6. Create a short implementation plan.
7. Only then modify code.

After coding:

1. Run all required validations.
2. Fix all failures.
3. Re-run the full validation suite.
4. Verify no architectural regressions were introduced.
5. Update documentation.
6. Update Serena MCP memory.

---

## 5. Required Validation Commands

Run the following commands when working on implementation tasks:

```bash
pnpm typecheck
pnpm lint
pnpm tests:unit
pnpm test:integration
pnpm tests:e2e
pnpm build
pnpm arch:deps
pnpm arch:cycles
pnpm arch:dead
```

Use command output as implementation evidence.

A task is NOT complete until all checks pass successfully.

If any validation fails:

1. Find the root cause.
2. Fix the issue.
3. Re-run the full validation suite.
4. Continue until all checks pass.

Never bypass failing checks.
Never weaken tests simply to make them pass.

---

## 6. TypeScript API Design Rules

### Public API Rules

* Preserve type inference wherever possible.
* Avoid widening generic types.
* Avoid unnecessary overloads.
* Avoid introducing `any` into public APIs.
* Prefer `unknown` over `any`.
* Prefer strongly typed builder patterns.
* Preserve fluent API composability.
* Preserve chainability.
* Keep APIs predictable and discoverable.

### Generic Type Rules

* Maintain generic propagation across chained calls.
* Avoid breaking conditional type behavior.
* Avoid distributive type regressions.
* Avoid inference degradation.
* Prefer explicit utility types for readability.

### Breaking Changes

Any breaking change must:

* be explicitly documented;
* include migration reasoning;
* include affected APIs/packages;
* be validated across the monorepo.

---

## 7. Monorepo and Package Boundary Rules

### Dependency Rules

* Do not introduce circular dependencies.
* Do not bypass package boundaries.
* Do not import package internals unless explicitly allowed.
* Public APIs must go through package entrypoints.
* Shared abstractions belong in shared/core packages.
* Do not duplicate shared logic across packages.

### Cross-Package Changes

When changing shared APIs:

1. Inspect all downstream usages.
2. Verify type compatibility.
3. Verify runtime compatibility.
4. Verify tests across affected packages.
5. Verify exported API surfaces.

---

## 8. Testing Rules

### Required Testing

* Add or update unit tests for new behavior.
* Add integration tests for cross-package behavior.
* Add regression tests for bug fixes.
* Add type-level tests for generic/type inference behavior.
* Verify fluent API typing behavior.

### Forbidden Practices

* Do not delete failing tests without justification.
* Do not weaken assertions to force passing results.
* Do not skip tests unless explicitly approved.
* Do not ignore TypeScript errors.

---

## 9. Architecture Analysis Commands

Run architecture tooling when making structural changes:

```bash
pnpm arch:deps
pnpm arch:cycles
pnpm arch:dead
```

Use tool output as architectural evidence.

---

## 10. Task and Documentation Rules

When implementing tasks from:

```text
project-documents/tasks/dev-plans/
```

Rules:

1. Read the task file fully before implementation.
2. Keep implementation aligned with the task scope.
3. Update:

```text
project-documents/tasks/dev-plans/README.md
```

after completion.

Required README updates:

* mark the task as completed in all relevant sections;
* update section `7. Implementation order`;
* synchronize documentation with implementation status.

---

## 11. Pull Request Rules

Before creating a PR:

1. Ensure all validations pass.
2. Ensure the monorepo builds successfully.
3. Ensure documentation is updated.
4. Ensure architectural checks pass.
5. Ensure no unrelated files were modified.

PR descriptions should include:

* implemented functionality;
* modified packages/files;
* architectural impact;
* executed validations;
* final validation status.

---

## 12. Serena MCP Memory Updates

After completing a task:

Update Serena MCP knowledge/memory with:

* new architectural decisions;
* public API changes;
* package boundary changes;
* important implementation details;
* typing strategy changes;
* validation outcomes;
* known limitations or follow-up concerns.

The Serena memory should reflect the latest repository architecture and implementation state.

---

## 13. General Engineering Rules

* Prefer explicitness over implicit behavior.
* Prefer maintainability over cleverness.
* Prefer deterministic behavior over magic abstractions.
* Keep runtime behavior aligned with type-level behavior.
* Avoid hidden side effects.
* Keep naming consistent across packages.
* Keep APIs cohesive.
* Minimize technical debt introduction.
* Do not perform unrelated cleanup during feature implementation.

---

## 14. Available Skills

The environment exposes reusable **skills** — packaged domain expertise and standard
workflows. Invoke a skill as `/<name>` (or via the Skill tool). Use them deliberately:
**match the skills to the task type; do not invoke all of them on every task.**

### Planning & architecture

| Skill | Use it for |
|---|---|
| `/engineering:architecture` | ADRs; choosing between technologies; documenting a design decision with trade-offs and consequences. |
| `/engineering:system-design` | Designing services/APIs, data models, and module/package boundaries before coding. |
| `/clean-architecture` | Enforcing layering, inward dependency direction, package boundaries, and SOLID. |

### TypeScript implementation

| Skill | Use it for |
|---|---|
| `/typescript-expert` | Type-level programming, monorepo management, migrations, tooling, performance. Primary TS skill. |
| `/typescript-best-practices` | Type-first design, making illegal states unrepresentable, exhaustive handling, runtime validation. |
| `/typescript-advanced-types-v2` | Generics, conditional/mapped/template-literal types, utility types for builders & fluent APIs. |
| `/typescript` | `tsc` performance, `tsconfig` configuration, resolving TS errors, module organization. |
| `/ts-library` | Library authoring: package `exports`, build tooling, public API design, type-inference preservation. |
| `/turborepo` | `turbo.json`, task pipelines, caching, `--filter`/`--affected`, cross-package wiring. |
| `/error-handling-patterns` | Designing exception hierarchies, Result/Either types, retry/circuit-breaker, error boundaries. |
| `/code-refactoring-refactor-clean-v2` | Clean-code + SOLID refactoring (Extract Class, Template Method, guard clauses, DRY). |
| `/sql-optimization-patterns` | Query optimization, indexing, EXPLAIN — for query-generation / DDL / DML tasks only. |

### Testing, review & verification

| Skill | Use it for |
|---|---|
| `/engineering:testing-strategy` | Designing the test plan & coverage (unit / integration / e2e / type-level). |
| `/code-review` | Reviewing the diff for correctness bugs, type-inference regressions, API/boundary breaks. |
| `/engineering:code-review` | Reviewing architectural consistency, SOLID adherence, design-pattern correctness. |
| `/simplify` | Removing over-engineering and duplication; reuse/efficiency cleanups (quality, not bug-hunting). |
| `/security-review` | Auditing changes for injection, unsafe coercions / `any` leaks, input-validation gaps. |
| `/verify` | Running the app/feature end-to-end to confirm behaviour — not just type/unit pass. |
| `/engineering:debug` | Structured reproduce → isolate → diagnose → fix when behaviour diverges from expected. |

### Process, docs & release

| Skill | Use it for |
|---|---|
| `/engineering:tech-debt` | Identifying, categorizing, and documenting tech debt / follow-ups. |
| `/engineering:documentation` | Writing/maintaining READMEs, task docs, runbooks, API docs. |
| `/engineering:deploy-checklist` | Pre-PR / pre-deploy verification checklist. |

> **Rule of thumb — match skills to the task.** Hygiene/tooling tasks need few (review +
> docs); architecture tasks pull in the planning + `/clean-architecture` + TS-design skills;
> refactors lead with `/code-refactoring-refactor-clean-v2`; anything emitting SQL/DDL adds
> `/sql-optimization-patterns` and `/security-review`.

---

## 15. Error Handling Rules

All errors thrown by production/library code **must** inherit from the project's base error
hierarchy. Never throw `new Error(...)` or ad-hoc / plain `Error` subclasses in shipped code.

### Base hierarchy

- The root is the abstract class **`OrmError`** in `@ts-linq/types`
  (`packages/types/src/errors.ts`).
- Every concrete failure extends `OrmError` (or a fitting intermediate such as
  `DatabaseError`) and carries:
  - a stable, machine-readable `code` (a literal from `OrmErrorCode`);
  - an optional structured `details` payload (safe-to-log keys only — never secrets / PII);
  - a preserved `cause` chain (native ES2022 `Error` cause; requires `ES2022.Error` in `lib`).
- Reuse the existing concrete classes before inventing new ones: `DatabaseError`,
  `OptimisticConcurrencyError`, `UniqueConstraintError`, `ForeignKeyConstraintError`,
  `ValidationError`, `TemporalNotSupportedError`, `UnsupportedOperationError`,
  `MetadataError`, `DecoratorUsageError`, `BatchConfigurationError`, `InvalidIncludeError`,
  `OperationAbortedError`.

### Rules

1. **Inherit, don't reinvent.** Reuse the closest existing `OrmError` subclass. If none fits,
   add a new subclass **in `@ts-linq/types/errors.ts`** with a new stable `OrmErrorCode`
   entry. Do **not** create parallel / competing error hierarchies in downstream packages.
2. **Always chain the cause.** When wrapping a lower-level failure, pass it via `{ cause }`
   so the original error is preserved.
3. **No silent swallows.** Never use a bare / empty `catch` to drop an error on a
   correctness-critical path. Either handle it explicitly or wrap-and-rethrow as a typed
   `OrmError`. A legitimate capability probe must be a single, documented check — not an
   ad-hoc swallow.
4. **Discriminate by type / code, not strings.** Consumers use `e instanceof OrmError` and
   `e.code`; never string-match messages. Keep messages user-safe.
5. **Changeset impact.** Adding a new error class / code is a `minor` change to
   `@ts-linq/types`; changing or removing one is `major`.