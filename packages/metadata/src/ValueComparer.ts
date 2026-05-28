import type { ValueComparerLike } from '@ts-linq/types';

export class ValueComparer<T> implements ValueComparerLike<T> {
  constructor(
    public readonly equals: (a: T, b: T) => boolean,
    public readonly hash: (v: T) => number,
    public readonly snapshot: (v: T) => T
  ) {}
}
