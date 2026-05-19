import type { MetadataRegistry } from '@ts-linq/metadata';
import type { ColumnMetadata, IndexMetadata, RelationshipMetadata } from '@ts-linq/types';

import { CollectionNavigationBuilder } from './CollectionNavigationBuilder';
import { IndexBuilder } from './IndexBuilder';
import { PropertyBuilder } from './PropertyBuilder';
import { ReferenceNavigationBuilder } from './ReferenceNavigationBuilder';
import { extractPropertyName } from './utils';

/**
 * Fluent builder for configuring a single entity type.
 * Mirrors EF Core's EntityTypeBuilder<T>.
 *
 * All configuration is accumulated internally and written to the registry
 * in a single batch when ModelBuilder._finalize() calls _applyToRegistry().
 * This ensures decorator metadata is fully settled before fluent overrides run.
 */
export class EntityTypeBuilder<T> {
  private _tableName?: string;
  private _schema?: string;
  private _primaryKeys?: string[];
  /** Columns added or overridden via the fluent API. */
  private readonly _columns: Map<string, ColumnMetadata> = new Map();
  private readonly _relationships: RelationshipMetadata[] = [];
  private readonly _indexes: IndexMetadata[] = [];

  constructor(private readonly _ctor: new () => T) {}

  // ── Table mapping ──────────────────────────────────────────────────────────

  /**
   * Map this entity to a specific table name (and optional schema).
   * Mirrors EF Core: b.ToTable("users") / b.ToTable("users", "dbo")
   */
  toTable(name: string, schema?: string): this {
    this._tableName = name;
    if (schema !== undefined) this._schema = schema;
    return this;
  }

  // ── Key configuration ──────────────────────────────────────────────────────

  /**
   * Define the primary key. Replaces any decorator-defined PKs (fluent wins).
   * Mirrors EF Core: b.HasKey(u => u.Id) / b.HasKey(u => new { u.A, u.B })
   *
   * Accepts property names directly for composite keys:
   *   builder.hasKey('id')
   *   builder.hasKey('sourceId', 'targetId')
   */
  hasKey<K extends keyof T>(...keys: K[]): this {
    this._primaryKeys = keys as string[];
    return this;
  }

  // ── Property / column configuration ───────────────────────────────────────

  /**
   * Configure a scalar property.
   * Mirrors EF Core: b.Property(u => u.Email).HasMaxLength(256).IsRequired()
   */
  property<K extends keyof T>(selector: (e: T) => T[K]): PropertyBuilder<T[K]> {
    const propName = extractPropertyName(selector);
    return new PropertyBuilder<T[K]>(propName, this._columns);
  }

  // ── Navigation / relationship configuration ────────────────────────────────

  /**
   * Start configuring a reference navigation (single related entity).
   * Mirrors EF Core: b.HasOne(u => u.Profile)
   *
   * @param selector   Navigation property selector on T.
   * @param relClass   Optional: pass the related entity constructor to store
   *                   the target entity class (TypeScript generics are erased).
   */
  hasOne<TRel>(
    selector: (e: T) => TRel | null | undefined,
    relClass?: new () => TRel
  ): ReferenceNavigationBuilder<T, TRel> {
    const propName = extractPropertyName(selector);
    return new ReferenceNavigationBuilder<T, TRel>(
      this._ctor,
      propName,
      relClass,
      this._relationships
    );
  }

  /**
   * Start configuring a collection navigation (multiple related entities).
   * Mirrors EF Core: b.HasMany(u => u.Posts)
   *
   * @param selector   Navigation property selector on T.
   * @param relClass   Optional: pass the related entity constructor.
   */
  hasMany<TRel>(
    selector: (e: T) => TRel[],
    relClass?: new () => TRel
  ): CollectionNavigationBuilder<T, TRel> {
    const propName = extractPropertyName(selector);
    return new CollectionNavigationBuilder<T, TRel>(
      this._ctor,
      propName,
      relClass,
      this._relationships
    );
  }

  // ── Index configuration ────────────────────────────────────────────────────

  /**
   * Configure a database index on one or more columns.
   * Mirrors EF Core: b.HasIndex(u => u.Email).IsUnique()
   */
  hasIndex<K extends keyof T>(...keys: K[]): IndexBuilder<T> {
    return new IndexBuilder<T>(this._ctor, keys as string[], this._indexes);
  }

  // ── Internal: apply to registry ───────────────────────────────────────────

  /**
   * Write all accumulated fluent configuration to the registry.
   * Called by ModelBuilder._finalize() AFTER onModelCreating() returns,
   * so decorators are settled first and fluent overrides win on conflict.
   *
   * @internal
   */
  _applyToRegistry(registry: MetadataRegistry): void {
    // Ensure entity is registered (creates builder if absent, updates tableName if present)
    registry.addEntity(this._ctor, this._tableName);

    // Schema override
    if (this._schema !== undefined) {
      registry.mergeFluentSchema(this._ctor, this._schema);
    }

    // Primary key replacement (fluent wins over decorators when hasKey() was called)
    if (this._primaryKeys !== undefined) {
      registry.setFluentPrimaryKeys(this._ctor, this._primaryKeys);
    }

    // Column merges
    for (const column of this._columns.values()) {
      registry.mergeFluentColumn(this._ctor, column);
    }

    // Relationship merges
    for (const rel of this._relationships) {
      registry.mergeFluentRelationship(this._ctor, rel);
    }

    // Index merges
    for (const idx of this._indexes) {
      registry.mergeFluentIndex(this._ctor, idx);
    }
  }
}
