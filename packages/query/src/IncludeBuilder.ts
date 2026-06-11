import { MetadataStorage } from '@ts-linq/metadata';
import type { EntityCtorRef } from '@ts-linq/types';

import { IncludeResolutionError } from './errors';
import { extractKey } from './extractKey';
import { IncludeSubquery } from './include/IncludeSubquery';
import { resolveTargetCtor } from './includeUtils';

/**
 * The validated outcome of an `include(...)` call. The facade applies it to chain state through
 * `withModel`, so this builder stays free of any `Queryable` instance state.
 */
export type IncludeDecision =
  | { kind: 'simple'; key: string }
  | { kind: 'filtered'; key: string; subquery: IncludeSubquery<unknown> };

/**
 * Resolves and validates `include` / `thenInclude` calls: drives the filtered-include `Proxy`,
 * distinguishes filtered vs simple includes, and walks the relationship-metadata chain to validate
 * nested paths. SQL-free and stateless apart from the entity binding — shared across clones.
 */
export class IncludeBuilder<T> {
  constructor(private readonly entityClass: new () => T) {}

  /** Resolve an `include(...)` argument (string key, plain lambda, or filtered lambda). */
  resolveInclude(keyOrSelector: unknown): IncludeDecision {
    // ── String key ──────────────────────────────────────────────────────────
    if (typeof keyOrSelector !== 'function') {
      return this.simple(String(keyOrSelector));
    }

    // ── Lambda: try filtered-include proxy first ─────────────────────────────
    // The proxy returns an IncludeSubquery for any property access. A filtered lambda
    // (b => b.posts.where(...).take(10)) yields an IncludeSubquery with specs captured; a plain
    // lambda (b => b.posts) yields one with isFiltered === false → treated as a simple include.
    const makeIncludeProxy = (): T =>
      new Proxy({} as object, {
        get(_target, prop) {
          return new IncludeSubquery<unknown>(String(prop));
        }
      }) as unknown as T;
    let proxyResult: unknown;
    try {
      proxyResult = (keyOrSelector as (entity: T) => unknown)(makeIncludeProxy());
    } catch (err) {
      // Proxy call threw (e.g. forbidden operator). Surface the captured error directly —
      // re-running the lambda would invoke user side effects a second time.
      throw err;
    }

    if (proxyResult instanceof IncludeSubquery) {
      const subquery = proxyResult as IncludeSubquery<unknown>;
      const key = subquery.propertyName;
      this.validate(key);
      return subquery.isFiltered ? { kind: 'filtered', key, subquery } : { kind: 'simple', key };
    }

    // ── Fallback: plain key-extractor lambda (single property access) ────────
    return this.simple(extractKey(keyOrSelector as (entity: T) => T[keyof T]));
  }

  /**
   * Resolve a `thenInclude(...)` selector into the full validated include path. The caller is
   * responsible for guarding that a prior `include()` set `lastIncludePath`.
   */
  resolveThenInclude(lastIncludePath: string, selector: (nav: never) => unknown): string {
    const nestedKey = extractKey(selector as (entity: never) => never[keyof never]);

    // Walk the metadata chain from the root entity class to the leaf entity in the current chain.
    let currentClass: EntityCtorRef = this.entityClass;
    for (const segment of lastIncludePath.split('.')) {
      const meta = MetadataStorage.getEntity(currentClass);
      if (!meta) break;
      const rel = meta.relationships.find((r) => r.propertyName === segment);
      if (!rel) break;
      const ctor = resolveTargetCtor(rel.targetEntity);
      if (!ctor) break;
      currentClass = ctor;
    }

    const leafMeta = MetadataStorage.getEntity(currentClass);
    if (leafMeta) {
      const valid = leafMeta.relationships.some((r) => r.propertyName === nestedKey);
      if (!valid) {
        const fullPath = `${lastIncludePath}.${nestedKey}`;
        throw new IncludeResolutionError(
          'UNKNOWN_PROPERTY',
          `Property '${nestedKey}' does not exist on entity '${currentClass.name}'. ` +
            `Check the include path '${fullPath}' for typos or missing relationship decorators.`,
          {
            entityName: currentClass.name,
            propertyPath: fullPath,
            propertyName: nestedKey
          }
        );
      }
    }

    return `${lastIncludePath}.${nestedKey}`;
  }

  private simple(key: string): IncludeDecision {
    this.validate(key);
    return { kind: 'simple', key };
  }

  private validate(key: string): void {
    const metadata = MetadataStorage.getEntity(this.entityClass);
    const valid = metadata?.relationships.some((r) => r.propertyName === key);
    if (!valid) {
      throw new IncludeResolutionError(
        'UNKNOWN_PROPERTY',
        `Property '${key}' does not exist on entity '${this.entityClass.name}'. ` +
          `Define relationship '${key}' via decorators or fix the name.`,
        {
          entityName: this.entityClass.name,
          propertyPath: key,
          propertyName: key
        }
      );
    }
  }
}
