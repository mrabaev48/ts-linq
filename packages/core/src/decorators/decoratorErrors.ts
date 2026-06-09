import { DecoratorUsageError } from '@ts-linq/types';

/**
 * Factory for the "requires TS5 Stage-3 decorators" capability guard shared by
 * every decorator in this package. Collapses the previously duplicated bare
 * "@X requires TS5 Stage-3 decorators" throws into a single typed
 * {@link DecoratorUsageError} carrying the decorator name in `details`.
 *
 * @param decorator The decorator identifier as written in source (e.g. `@ValidIf`).
 */
export function stage3DecoratorError(decorator: string): DecoratorUsageError {
  return new DecoratorUsageError(`${decorator} requires TS5 Stage-3 decorators`, {
    details: { decorator }
  });
}
