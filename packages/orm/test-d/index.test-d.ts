/**
 * Type-level tests for ISSUE-007: OrderedQueryable<T> encodes ordering state.
 *
 * Run manually with `tsd` after building: `pnpm -F @ts-linq/orm tsd`
 * These tests are not part of the Jest suite but serve as permanent regression guards.
 */
import { expectType } from 'tsd';
import type { OrderedQueryable, Queryable } from '@ts-linq/query';

import type { DbSet } from '../src/DbSet';

type User = { id: number; name: string; age: number };
declare const users: DbSet<User>;

// orderBy / orderByDescending must return OrderedQueryable (not plain Queryable)
expectType<OrderedQueryable<User>>(users.orderBy('name'));
expectType<OrderedQueryable<User>>(users.orderBy((u) => u.age));
expectType<OrderedQueryable<User>>(users.orderByDescending('id'));

// thenBy / thenByDescending are available on OrderedQueryable
expectType<OrderedQueryable<User>>(users.orderBy('name').thenBy('age'));
expectType<OrderedQueryable<User>>(users.orderBy('name').thenByDescending('id'));
expectType<OrderedQueryable<User>>(users.orderBy('name').thenBy('age').thenByDescending('id'));

// Further chaining (take/skip/where) still returns Queryable<User>
expectType<Queryable<User>>(users.orderBy('name').thenBy('age').take(10));

// @ts-expect-error — thenBy directly on DbSet is a compile error (no prior orderBy)
users.thenBy('name');

// @ts-expect-error — thenByDescending directly on DbSet is a compile error
users.thenByDescending('name');

// @ts-expect-error — lambda returning a literal (not a property) fails to compile
users.orderBy(() => 42 as unknown as User[keyof User]);

// ── P2-33: StoredProcedureBuilder type-level tests ──────────────────────────
import { StoredProcedureBuilder } from '@ts-linq/metadata';
import type { EntityTypeBuilder } from '../src/builders/EntityTypeBuilder';

type Person = { id: number; name: string };
declare const etb: EntityTypeBuilder<Person>;

// insertUsingStoredProcedure / updateUsingStoredProcedure / deleteUsingStoredProcedure
// must return the same EntityTypeBuilder<Person> for chaining.
expectType<EntityTypeBuilder<Person>>(etb.insertUsingStoredProcedure('Proc_Insert'));
expectType<EntityTypeBuilder<Person>>(etb.updateUsingStoredProcedure('Proc_Update'));
expectType<EntityTypeBuilder<Person>>(etb.deleteUsingStoredProcedure('Proc_Delete'));

// hasParameter must accept valid property selectors.
declare const spb: StoredProcedureBuilder<Person>;
expectType<StoredProcedureBuilder<Person>>(spb.hasParameter((p) => p.name));
expectType<StoredProcedureBuilder<Person>>(spb.hasParameter((p) => p.id, (b) => b.isOutput()));
expectType<StoredProcedureBuilder<Person>>(spb.hasOriginalValueParameter((p) => p.id));
