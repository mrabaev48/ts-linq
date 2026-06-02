---
status: not-started
phase: phase-x
package: orm
priority: P2
effort: L
risk: medium
category: clean-code
depends_on: []
related: []
---

# Refactor: Split `EntityTypeBuilder` configuration axes

## Problem

`packages/orm/src/builders/EntityTypeBuilder.ts` (575 LOC) is a single fluent
builder that accumulates ~25 unrelated configuration axes and writes them all out
in one 120-line `_applyToRegistry` method. It mixes table/schema/keys, columns,
relationships, indexes, alternate keys, temporal config, owned types, complex
types, inheritance (TPH/TPT/TPC + discriminator), skip-navigation (m2m), query
filters, check constraints, comments, seed data, shadow properties, table
fragments (entity splitting), keyless/views, property access mode, and stored-
procedure mapping.

## Evidence

- ~22 private fields (lines 54–82), each a distinct feature's accumulator.
- `_applyToRegistry` (450–569) — a 119-line sequential write-out touching 20+
  registry merge methods.
- Unrelated concerns interleaved: SP mapping (419–447), inheritance strategy
  (301–324), entity splitting (139–152), shadow columns (530–544).
- `@ts-linq/no-explicit-any`-suppressed fields for owned/complex/skip-nav/
  discriminator builders (62–70).

## Why this is bad

- SRP violation: one class is the configuration surface for every mapping feature
  in the ORM; every new feature edits this file.
- High change-coupling and merge-conflict surface (like `DbContext`).
- `_applyToRegistry` is a long method with no sub-structure; ordering
  dependencies (e.g. "skip-nav after primary keys", line 512) are implicit.
- Hard to unit-test a single axis without instantiating the whole builder.

## Target architecture

Keep the fluent `EntityTypeBuilder` as the **public facade** (its chained API is
load-bearing and must not change), but delegate accumulation and registry write-
out to cohesive, per-concern *aspect* objects (composition + SRP):

- Group axes into aspects, each owning its accumulators + an `applyTo(registry,
  ctor, ctx)` method: `KeyAndTableAspect`, `ColumnAspect`, `RelationshipAspect`,
  `IndexAndConstraintAspect`, `InheritanceAspect`, `OwnedAndComplexAspect`,
  `SkipNavigationAspect`, `TableSplittingAspect`, `QueryFilterAspect`,
  `StoredProcedureAspect`, `MiscMetadataAspect` (comment/seed/keyless/view).
- `EntityTypeBuilder` holds the aspect set; each fluent method delegates to the
  owning aspect. `_applyToRegistry` becomes: iterate aspects in a declared,
  documented order, calling `aspect.applyTo(...)`.
- Make the ordering dependency explicit (e.g. an `applyOrder` or topological
  declaration) instead of the implicit "PKs before skip-nav" sequencing.

## Proposed refactor

1. Define an `EntityConfigAspect` interface
   (`applyTo(registry, ctor, ctx): void`).
2. Extract aspects incrementally; for each, move the fields + fluent method
   bodies + the matching block from `_applyToRegistry`.
3. Replace `_applyToRegistry` with an ordered aspect loop, documenting the
   ordering contract (the `leftPk` dependency at line 513 becomes a passed
   `ctx`).
4. Preserve every public method signature and the
   `__tsLinqEntityTypeBuilderBrand` (used by the transformer).

## Suggested design patterns

- **Composite of aspects / Builder decomposition** — each aspect is independently
  testable and additive (extensibility: new feature = new aspect, no edits to
  existing ones — Open/Closed).
- **Facade** — `EntityTypeBuilder` keeps the ergonomic fluent API.
- **Visitor-ish apply order** — explicit ordered write-out replaces implicit
  sequencing.

## Testing plan

- **Unit:** each aspect's `applyTo` against a mock `MetadataRegistry`.
- **Regression:** `tests/entity-type-builder-*.test.ts`,
  `tests/owned-navigation-builder*.test.ts`,
  `tests/discriminator-builder.test.ts`, `tests/complex-type-builder.test.ts`,
  `tests-new/ModelBuilder.test.ts`, `tests-new/StoredProcedureBuilder.test.ts`
  must pass unchanged.
- **Ordering:** a test asserting PK-dependent aspects (skip-nav) run after keys.

## Acceptance criteria

- [ ] `EntityTypeBuilder.ts` reduced (target < 250 LOC) with logic in aspects.
- [ ] `_applyToRegistry` is an ordered aspect loop with a documented order.
- [ ] Fluent public API and transformer brand unchanged.
- [ ] All builder test suites pass.
- [ ] `pnpm typecheck && pnpm lint` pass.

## Refactor order

1. `EntityConfigAspect` interface + apply-context value object.
2. Extract aspects one at a time behind passing regression tests.
3. Convert `_applyToRegistry` to the ordered loop last.

## Notes

This is a lower-priority cleanup (P2) — no runtime behavior change intended;
purely structural. Defer until the P0/P1 ORM tasks are stable to avoid churn on
a heavily-tested file.
