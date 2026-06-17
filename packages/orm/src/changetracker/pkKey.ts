import type { MetadataRegistry } from '@ts-linq/metadata';
import type { EntityCtorRef } from '@ts-linq/types';

/**
 * Single source of primary-key string keying shared by every identity map in the
 * package (refactor task-4) — the change tracker's {@link TrackedIdentityMap} and
 * the public `IdentityMap`. Keeps composite-PK keying defined in exactly one place.
 *
 * Keys are built from PK column names **sorted alphabetically** so the result is
 * independent of property enumeration order.
 */

/**
 * Build a stable key from an entity's primary-key values. Returns `undefined`
 * when the entity has no PK metadata or any PK column is missing (`undefined`/`null`).
 */
export function pkTupleFromEntity(
  entity: object,
  entityClass: EntityCtorRef,
  registry: MetadataRegistry
): string | undefined {
  const pks = registry.getEntity(entityClass)?.primaryKeys;
  if (!pks?.length) return undefined;
  const rec = entity as Record<string, unknown>;
  const sorted = [...pks].sort();
  const values = sorted.map((k) => rec[k]);
  if (values.some((v) => v === undefined || v === null)) return undefined;
  return JSON.stringify(values);
}

/**
 * Build a key from raw PK value(s) supplied by a lookup caller. Values must be
 * provided in the **alphabetical order of the PK column names** (the same order
 * used by {@link pkTupleFromEntity}). Returns `undefined` when the class has no
 * PK metadata or no values were supplied.
 */
export function pkTupleFromValues(
  entityClass: EntityCtorRef,
  pkValues: readonly unknown[],
  registry: MetadataRegistry
): string | undefined {
  const pks = registry.getEntity(entityClass)?.primaryKeys;
  if (!pks?.length || pkValues.length === 0) return undefined;
  return JSON.stringify(pkValues.slice(0, pks.length));
}
