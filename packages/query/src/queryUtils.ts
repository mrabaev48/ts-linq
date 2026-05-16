import type { Result } from '@ts-linq/types';
import { err, ok } from '@ts-linq/types';
import type { Queryable } from './Queryable';

/**
 * Result-returning variant of Queryable.first(). Returns ok(T) or err(Error).
 * Extracted from Queryable as a standalone function to reduce the god-class surface.
 *
 * @example
 * const result = await tryFirst(context.books.orderBy('id'));
 * if (result.ok) console.log(result.value);
 */
export async function tryFirst<T>(queryable: Queryable<T>): Promise<Result<T, Error>> {
  try {
    return ok(await queryable.first());
  } catch (error) {
    return err(error as Error);
  }
}

/**
 * Result-returning variant of Queryable.single(). Returns ok(T) or err(Error).
 * Extracted from Queryable as a standalone function to reduce the god-class surface.
 *
 * @example
 * const result = await trySingle(context.books.where(b => b.id === 1));
 * if (result.ok) console.log(result.value);
 */
export async function trySingle<T>(queryable: Queryable<T>): Promise<Result<T, Error>> {
  try {
    return ok(await queryable.single());
  } catch (error) {
    return err(error as Error);
  }
}
