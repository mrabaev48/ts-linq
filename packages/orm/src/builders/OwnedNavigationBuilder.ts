import type { ColumnMetadata, OwnedEntityMetadata } from '@ts-linq/types';
import { StorageStrategy } from '@ts-linq/types';

import { PropertyBuilder } from './PropertyBuilder';
import { extractPropertyName } from './utils';

/**
 * Fluent builder for configuring an owned entity navigation.
 * Mirrors EF Core's OwnedNavigationBuilder<TOwner, TOwned>.
 *
 * Accumulates configuration and produces OwnedEntityMetadata via _buildMetadata().
 * Called from EntityTypeBuilder.ownsOne() / ownsMany().
 */
export class OwnedNavigationBuilder<TOwner, TOwned> {
  private _strategy: StorageStrategy = StorageStrategy.TableSplit;
  private _columnPrefix?: string;
  private _jsonColumnName?: string;
  private _foreignKeyColumns?: string[];
  private _principalKeyColumns?: string[];
  private _compositeKeyColumns?: string[];
  private readonly _columns: Map<string, ColumnMetadata> = new Map();

  constructor(
    private readonly _ownerCtor: new () => TOwner,
    private readonly _ownedCtor: new () => TOwned,
    private readonly _ownerPropertyName: string,
    private readonly _isCollection: boolean
  ) {}

  property<K extends keyof TOwned>(selector: (e: TOwned) => TOwned[K]): PropertyBuilder<TOwned[K]> {
    const propName = extractPropertyName(selector);
    return new PropertyBuilder<TOwned[K]>(propName, this._columns);
  }

  withOwner(_selector?: (e: TOwned) => TOwner): this {
    return this;
  }

  hasForeignKey(...props: string[]): this {
    this._foreignKeyColumns = props;
    return this;
  }

  hasKey(...props: string[]): this {
    this._compositeKeyColumns = props;
    return this;
  }

  toTable(_name: string): this {
    this._strategy = StorageStrategy.TableSplit;
    return this;
  }

  toJson(columnName?: string): this {
    this._strategy = StorageStrategy.Json;
    this._jsonColumnName = columnName ?? this._ownerPropertyName;
    return this;
  }

  columnPrefix(prefix: string): this {
    this._columnPrefix = prefix;
    return this;
  }

  /** @internal — called from EntityTypeBuilder._applyToRegistry() */
  _buildMetadata(): OwnedEntityMetadata {
    const strategy =
      this._isCollection && this._strategy === StorageStrategy.TableSplit
        ? StorageStrategy.SeparateTable
        : this._strategy;

    const meta: OwnedEntityMetadata = {
      ownerPropertyName: this._ownerPropertyName,
      ownedType: this._ownedCtor as unknown as Function,
      strategy,
      isCollection: this._isCollection
    };

    if (strategy === StorageStrategy.TableSplit) {
      meta.columnPrefix = this._columnPrefix ?? `${this._ownerPropertyName}_`;
    } else if (strategy === StorageStrategy.Json) {
      meta.jsonColumnName = this._jsonColumnName ?? this._ownerPropertyName;
    } else if (strategy === StorageStrategy.SeparateTable) {
      if (this._foreignKeyColumns) meta.foreignKeyColumns = this._foreignKeyColumns;
      if (this._principalKeyColumns) meta.principalKeyColumns = this._principalKeyColumns;
      if (this._compositeKeyColumns) meta.compositeKeyColumns = this._compositeKeyColumns;
    }

    return meta;
  }

  /** @internal — property overrides configured via .property() */
  _getColumnOverrides(): Map<string, ColumnMetadata> {
    return this._columns;
  }

  /** @internal */
  _getOwnedCtor(): new () => TOwned {
    return this._ownedCtor;
  }

  /** @internal */
  _getOwnerCtor(): new () => TOwner {
    return this._ownerCtor;
  }
}
