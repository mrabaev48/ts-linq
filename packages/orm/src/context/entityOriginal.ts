import { reflectGetOwnMetadata } from '@ts-linq/metadata';
import type { EntityCtorRef } from '@ts-linq/types';

/**
 * Resolve the original (undecorated) entity constructor for `target`.
 *
 * Decorator transformers stamp the original constructor under the
 * `orm:original` metadata key; when absent the input is already original.
 *
 * @internal
 */
export function getOriginal<T extends EntityCtorRef>(target: T): T {
  const maybe = reflectGetOwnMetadata('orm:original', target);
  return (maybe as T | undefined) ?? target;
}
