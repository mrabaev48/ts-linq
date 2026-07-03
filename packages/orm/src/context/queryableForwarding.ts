import { Queryable } from '@ts-linq/query';

/**
 * Members of `Queryable.prototype` that are **not** chain-starting operators and therefore must
 * never be forwarded onto `DbSet`:
 *
 * - lifecycle/internal helpers (`clone`, `withModel`, …) — implementation detail, not query intent;
 * - `effectiveSplittingBehavior` — a protected accessor, not an operator;
 * - `thenInclude` — mid-chain only: it requires a preceding `include()` and throws otherwise, so it
 *   is meaningless as a chain *start* from a set.
 *
 * Underscore-prefixed members (`_withRawSqlSource`, …) and non-function members are filtered
 * separately in {@link queryableOperatorNames}.
 *
 * This set is the single source of truth shared by the runtime forwarder installer and the
 * `DbSet ↔ Queryable` parity contract test.
 */
export const QUERYABLE_NON_OPERATORS: ReadonlySet<string> = new Set<string>([
  'constructor',
  'clone',
  'withModel',
  'applyPredicate',
  'buildRunSpec',
  'prepareQueryModel',
  'applyGlobalFiltersToModel',
  'resolveColumnName',
  'effectiveSplittingBehavior',
  'thenInclude'
]);

/**
 * Compute the forwardable `Queryable` operator names from `Queryable.prototype`.
 *
 * Drives both {@link installQueryableForwarders} and the parity test, so a new operator added to
 * `Queryable` is automatically surfaced on `DbSet` (zero drift) and asserted by the contract test.
 */
export function queryableOperatorNames(): string[] {
  const proto = Queryable.prototype as object;
  return Object.getOwnPropertyNames(proto).filter((name) => {
    if (name.startsWith('_')) return false;
    if (QUERYABLE_NON_OPERATORS.has(name)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(proto, name);
    return typeof descriptor?.value === 'function';
  });
}

/**
 * Install one delegating forwarder per `Queryable` operator onto `target` (`DbSet.prototype`),
 * routing each call through `seedAccessor(this)` — the cached chain-starting seed `Queryable`.
 *
 * Operators already defined directly on `target` are left untouched, so any future `DbSet`-specific
 * override wins over the generic forwarder.
 */
export function installQueryableForwarders(
  target: object,
  seedAccessor: (self: unknown) => Queryable<object>
): void {
  for (const name of queryableOperatorNames()) {
    if (Object.prototype.hasOwnProperty.call(target, name)) continue;
    Object.defineProperty(target, name, {
      value: function (this: unknown, ...args: unknown[]): unknown {
        const seed = seedAccessor(this) as object as Record<
          string,
          (...callArgs: unknown[]) => unknown
        >;
        return seed[name](...args);
      },
      writable: true,
      enumerable: false,
      configurable: true
    });
  }
}
