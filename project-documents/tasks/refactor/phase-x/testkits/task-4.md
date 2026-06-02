---
status: not-started
phase: phase-x
package: testkits
priority: P2
effort: M
risk: low
category: clean-code
depends_on: []
related: []
---

# Refactor: Consolidate duplicated test fixtures and entity hierarchies

## Problem

testkits defines two overlapping sets of test entities and mixes builder logic, entity
definitions, and fixture factories in one file. There is no single source of truth for the
"sample domain" used across tests, and fixture defaults are non-deterministic.

## Evidence

- `packages/testkits/src/builders/EntityBuilder.ts:40-63` defines `TestUser`, `TestPost`,
  `TestComment` **inside the builder module**.
- `packages/testkits/src/fixtures/TestEntities.ts:1-75` defines a *second*, overlapping set:
  `User`, `Post`, `Comment`, `Tag`, `Category`, `Product`, `Order`, `OrderItem`.
- Both files model User/Post/Comment with near-identical fields — two competing domains.
- `EntityBuilder.ts:65-87` (`userBuilder`/`postBuilder`/`commentBuilder`) couples generic
  builder code to specific entities, so the generic `EntityBuilder<T>` cannot be published
  without dragging the sample domain along.
- `EntityBuilder.ts:71,86` default `createdAt: new Date()` — non-deterministic fixtures that
  make snapshot/equality assertions flaky.

## Why this is bad

- Two entity hierarchies mean tests disagree on the canonical sample model; new tests pick
  one arbitrarily.
- SRP violation: `EntityBuilder.ts` is simultaneously a reusable builder, an entity
  declaration file, and a fixture factory.
- Non-deterministic `new Date()` defaults undermine reproducibility and snapshot stability.

## Target architecture

Apply **SRP** and the **Object Mother + Test Data Builder** patterns:

- `src/builders/EntityBuilder.ts` keeps **only** the generic `EntityBuilder<T>` + `builder()`.
- One canonical entity module (consolidate `TestEntities.ts`; drop the `Test*` duplicates or
  alias them).
- An Object-Mother module (`mothers/`) holds named factories (`aUser()`, `aPost()`) with
  **deterministic** defaults (fixed clock/value), composing the generic builder.

## Proposed refactor

1. Pick the canonical entity set (the richer `TestEntities.ts` graph) and delete/alias the
   `TestUser/TestPost/TestComment` duplicates.
2. Move `userBuilder`/`postBuilder`/`commentBuilder` into an Object-Mother module that imports
   the generic builder.
3. Replace `createdAt: new Date()` with a fixed deterministic default (e.g. a frozen
   `FIXED_NOW`).
4. Update the barrel and any consumers.

## Suggested design patterns

- **Test Data Builder** — generic `EntityBuilder<T>` for fluent, partial overrides. WHY:
  reusable, type-safe construction without coupling to a domain.
- **Object Mother** — named `aUser()`/`aPost()` factories with sensible defaults. WHY:
  expresses intent at call sites and centralises fixture defaults.

## Testing plan

- Keep/extend `EntityBuilder.test.ts` for the generic builder.
- Add a small test asserting mother factories produce deterministic output across calls.

## Acceptance criteria

- [ ] One canonical entity hierarchy; duplicate `Test*` classes removed or aliased.
- [ ] `EntityBuilder.ts` contains only the generic builder.
- [ ] Object-Mother factories live in their own module with deterministic defaults.
- [ ] No `new Date()` in default fixtures.

## Refactor order

1. Consolidate entities.
2. Split mothers out of the builder file.
3. De-flake date defaults.
4. Fix barrel + consumers.

## Notes

- Pairs naturally with task-1: the contract harness should seed from the canonical mothers.
