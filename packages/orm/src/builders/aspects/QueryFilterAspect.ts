import type { QueryFilterMetadata } from '@ts-linq/types';

import type { EntityConfigAspect } from './EntityConfigAspect';

/**
 * Global query filters.
 *
 * Filters are per-`DbContext` (they are not written to the global `MetadataRegistry`), so
 * {@link applyTo} is intentionally a no-op — the filters are read back via `getQueryFilters()`.
 * The public `hasQueryFilter` throw and the compile-time-transformer entry point
 * (`hasQueryFilterCompiled`) live on the `EntityTypeBuilder` facade; this aspect owns the
 * accumulator and the compiled-filter merge logic.
 */
export class QueryFilterAspect<T extends object> implements EntityConfigAspect<T> {
  private readonly _queryFilters: QueryFilterMetadata[] = [];

  hasQueryFilterCompiled(
    nameOrCompiled: string | { ast: unknown; parameters: readonly unknown[] },
    compiled?: { ast: unknown; parameters: readonly unknown[] }
  ): void {
    let name: string;
    let filter: { ast: unknown; parameters: readonly unknown[] };
    if (typeof nameOrCompiled === 'string') {
      name = nameOrCompiled;
      filter = compiled!;
    } else {
      name = '_default';
      filter = nameOrCompiled;
    }
    const idx = this._queryFilters.findIndex((f) => f.name === name);
    const entry: QueryFilterMetadata = { name, ast: filter.ast, parameters: filter.parameters };
    if (idx >= 0) {
      this._queryFilters[idx] = entry;
    } else {
      this._queryFilters.push(entry);
    }
  }

  getQueryFilters(): ReadonlyArray<QueryFilterMetadata> {
    return this._queryFilters;
  }

  applyTo(): void {
    // Query filters are per-context; nothing is written to the global MetadataRegistry.
  }
}
