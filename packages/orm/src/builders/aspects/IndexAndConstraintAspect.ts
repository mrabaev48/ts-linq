import type { MetadataRegistry } from '@ts-linq/metadata';
import type { AlternateKeyMetadata, CheckConstraintMetadata, IndexMetadata } from '@ts-linq/types';

import { IndexBuilder } from '../IndexBuilder';
import { extractPropertyNames } from '../utils';
import type { EntityConfigAspect } from './EntityConfigAspect';

/**
 * Indexes, alternate (non-PK unique) keys, and check constraints.
 *
 * The `indexes` array is populated through the `IndexBuilder` returned by `hasIndex`; alternate
 * keys and check constraints are accumulated directly.
 */
export class IndexAndConstraintAspect<T extends object> implements EntityConfigAspect<T> {
  readonly indexes: IndexMetadata[] = [];
  private readonly _alternateKeys: AlternateKeyMetadata[] = [];
  private readonly _checkConstraints: CheckConstraintMetadata[] = [];

  constructor(private readonly _ctor: new () => T) {}

  hasIndex<K extends keyof T>(
    selectorOrKey: ((e: T) => unknown) | K,
    restKeys: readonly K[]
  ): IndexBuilder<T> {
    if (typeof selectorOrKey === 'function') {
      const cols = extractPropertyNames(selectorOrKey as (e: T) => unknown);
      return new IndexBuilder<T>(this._ctor, cols, this.indexes);
    }
    const cols = [selectorOrKey as string, ...(restKeys as readonly string[])];
    return new IndexBuilder<T>(this._ctor, cols, this.indexes);
  }

  hasAlternateKey(selector: (e: T) => unknown): void {
    const cols = extractPropertyNames(selector);
    const name = `AK_${this._ctor.name}_${cols.join('_')}`;
    this._alternateKeys.push({ name, columns: cols });
  }

  hasCheckConstraint(name: string, sql: string): void {
    this._checkConstraints.push({ name, sql });
  }

  applyTo(registry: MetadataRegistry, ctor: new () => T): void {
    for (const idx of this.indexes) {
      registry.mergeFluentIndex(ctor, idx);
    }

    for (const ak of this._alternateKeys) {
      registry.mergeFluentAlternateKey(ctor, ak);
    }

    if (this._checkConstraints.length > 0) {
      registry.setCheckConstraints(ctor, [...this._checkConstraints]);
    }
  }
}
