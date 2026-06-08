/**
 * Type-level tests for the entity-constructor typing of the metadata public API
 * (metadata/task-5).
 *
 * Run with `tsd` (the package must be built first so its `.d.ts` exists):
 *   `pnpm -F @ts-linq/metadata test-d`
 * or repo-wide via `pnpm test-d`.
 *
 * These are a permanent compile-time regression guard proving that:
 *  - the WRITE API (`addEntity`, …) is keyed on `EntityCtor` and rejects
 *    non-constructors (a plain function is a compile error);
 *  - the READ API (`getEntity`, …) accepts the wider `EntityCtorRef` (any
 *    constructor reference, incl. projection element ctors) while still
 *    rejecting plain functions.
 *
 * No `any`, casts, or `@ts-expect-error` — negative assertions use `tsd`.
 */
import type { EntityCtor, EntityCtorRef } from '@ts-linq/types';
import { expectAssignable, expectError, expectNotAssignable } from 'tsd';

import { createMetadataRegistry } from '..';

const registry = createMetadataRegistry();

// A parameterless entity class — the canonical valid target.
class User {}
// A plain (non-constructor) function — must never be accepted.
function notAClass(): void {}

// ─── Write API (EntityCtor) ──────────────────────────────────────────────────

// A real entity constructor is accepted.
registry.addEntity(User);
registry.addEntity(User, 'users');

// A plain function is NOT a constructor → compile error.
expectError(registry.addEntity(notAClass));
// Arbitrary non-constructor values are rejected too.
expectError(registry.addEntity({}));
expectError(registry.addEntity(42));

// ─── Read API (EntityCtorRef) ────────────────────────────────────────────────

// Entity constructors and any `new () => T` (incl. scalar-projection element
// constructors produced by `Queryable.select`) are accepted.
registry.getEntity(User);
declare const scalarProjectionCtor: new () => string;
registry.getEntity(scalarProjectionCtor);

// A plain function is still rejected on the read side.
expectError(registry.getEntity(notAClass));

// ─── Type-level aliases ──────────────────────────────────────────────────────

// EntityCtor: parameterless classes assignable, plain functions are not.
expectAssignable<EntityCtor>(User);
expectNotAssignable<EntityCtor>(notAClass);

// EntityCtorRef: broader, but plain functions remain unrepresentable.
expectAssignable<EntityCtorRef>(User);
expectAssignable<EntityCtorRef>(scalarProjectionCtor);
expectNotAssignable<EntityCtorRef>(notAClass);
