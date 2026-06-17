import { describe, expect, it } from '@jest/globals';

import type { IQueryableSurface } from '../src/IQueryableSurface';
import type { Queryable } from '../src/Queryable';

/**
 * Contract guard (orm/task-3): `Queryable<T>` must structurally satisfy {@link IQueryableSurface}.
 *
 * `Queryable` itself cannot `implements IQueryableSurface` in `src` — that import edge would form a
 * cycle with `IQueryableSurface` (which references `Queryable` for its return types) and break the
 * no-circular architecture rule. This assignability assertion lives in a test file instead (outside
 * the dependency-cruiser graph) and is enforced by ts-jest type-checking: if a `Queryable` operator
 * signature ever drifts from the surface contract that `DbSet` merges, this stops compiling.
 */

interface Sample {
  id: number;
  name: string;
}

// Type-level only: a `Queryable<Sample>` must be assignable to the surface contract.
type _QueryableSatisfiesSurface =
  Queryable<Sample> extends IQueryableSurface<Sample> ? true : never;
const _assert: _QueryableSatisfiesSurface = true;

describe('IQueryableSurface contract', () => {
  it('is structurally satisfied by Queryable (enforced by ts-jest)', () => {
    expect(_assert).toBe(true);
  });
});
