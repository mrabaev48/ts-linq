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

## 14. Versioning and Changesets Rules

This project uses [Changesets](https://github.com/changesets/changesets) for versioning and
changelog generation. Package versions are never bumped manually in `package.json` or via git
tags. All bumps are driven by changeset files.

### When to Create a Changeset

Create a changeset for any PR that:

* adds, removes, or changes a **public API** (exported types, function signatures, identifiers);
* changes **runtime behavior** that consumers of any package would observe;
* fixes a **bug** in a versioned package;
* introduces a **breaking change** (always `major` + explicit migration docs);
* makes a **performance or behavioral improvement** worth communicating to users.

Do **not** create a changeset for:

* changes only in `@ts-linq/e2e-tests`, `@ts-linq/integration-tests`, `@ts-linq/examples`;
* `@ts-linq/eslint-config`, `@ts-linq/jest-config`, `@ts-linq/typescript-config`;
* documentation-only edits with no API change;
* CI/CD workflow changes.

### Change Type Selection

| Type | When |
|------|------|
| `patch` | Bug fix, internal refactor with no API surface change |
| `minor` | New exported API that is backward compatible |
| `major` | Breaking change — removal, rename, or incompatible signature change |

When in doubt, choose `patch`.

### How to Create a Changeset

```bash
pnpm changeset
```

The interactive wizard asks which packages are affected, the bump type, and a summary line.
It generates `.changeset/<random-name>.md`. Commit this file as part of your PR branch.

### Mandatory Rule

Any PR that modifies source in a versioned package MUST include a changeset file.

This is enforced by the `Changeset present` CI check. The PR cannot merge until it passes.

The "Version Packages" PR created by the Changesets Action is automatically exempted.

### Packages Excluded from Changesets

Never create changesets targeting:
`@ts-linq/e2e-tests`, `@ts-linq/integration-tests`, `@ts-linq/examples`,
`@ts-linq/eslint-config`, `@ts-linq/jest-config`, `@ts-linq/typescript-config`

### Release Flow

1. PR with source changes + `.changeset/*.md` merges to `main`
2. Release workflow creates "Version Packages" PR (bumps versions, writes CHANGELOG.md)
3. Maintainer reviews and merges the "Version Packages" PR
4. Release workflow publishes `@ts-linq/cache-redis`, `@ts-linq/cache-memcached`, `@ts-linq/cli`

### References

* Config: `.changeset/config.json`
* Changesets docs: https://github.com/changesets/changesets