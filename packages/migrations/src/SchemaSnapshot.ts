import type { DatabaseProvider } from '@ts-linq/core';
import { MetadataStorage, SequenceRegistry } from '@ts-linq/metadata';
import type { EntityMetadata, IndexMetadata, SequenceMetadata } from '@ts-linq/types';
import {
  ProviderRequiredError,
  SnapshotSerializationError,
  SnapshotValidationError
} from '@ts-linq/types';

import type { ColumnDef, IndexDef, SchemaSnapshot, TableSnapshot, ViewSnapshot } from './DiffTypes';
import { SchemaInspectorFactory } from './SchemaInspector';
import { ColumnMapper } from './snapshot/expanders/ColumnMapper';
import type { ExpansionContext } from './snapshot/expanders/EntityExpander';
import { ForeignKeyResolver } from './snapshot/expanders/schema/ForeignKeyResolver';
import { SequenceExpander } from './snapshot/expanders/schema/SequenceExpander';
import { ShadowPropertyExpander } from './snapshot/expanders/schema/ShadowPropertyExpander';
import { TableFragmentExpander } from './snapshot/expanders/schema/TableFragmentExpander';

/**
 * OOP builders/serializers for SchemaSnapshot with thin functional wrappers for back-compat.
 *
 * The builder is a thin coordinator: per entity it projects base columns via the shared
 * {@link ColumnMapper}, then runs the schema {@link ShadowPropertyExpander} /
 * {@link TableFragmentExpander} strategies and resolves foreign keys through
 * {@link ForeignKeyResolver}. Sequences are mapped by {@link SequenceExpander}. The entity
 * list and sequence list are injected via {@link SchemaSnapshotBuilder.buildFrom}; the no-arg
 * {@link SchemaSnapshotBuilder.buildExpectedFromMetadata} reads the global registries for
 * back-compatibility.
 */
export class SchemaSnapshotBuilder {
  private readonly provider?: DatabaseProvider;

  private readonly columnMapper = new ColumnMapper();
  private readonly shadowExpander = new ShadowPropertyExpander();
  private readonly fragmentExpander = new TableFragmentExpander();
  private readonly sequenceExpander = new SequenceExpander();
  private readonly foreignKeyResolver = new ForeignKeyResolver();

  constructor(provider?: DatabaseProvider) {
    this.provider = provider;
  }

  /**
   * Build the expected schema snapshot from the globally registered entities and
   * sequences. Back-compat entrypoint reading the global registries.
   */
  public buildExpectedFromMetadata(): SchemaSnapshot {
    return this.buildFrom(MetadataStorage.getEntities(), SequenceRegistry.getAll());
  }

  /**
   * Build the expected schema snapshot from an injected set of entities and sequences.
   * Inverts the global-registry coupling so the snapshot is testable in isolation.
   */
  public buildFrom(
    entities: ReadonlyArray<EntityMetadata>,
    sequences: ReadonlyArray<SequenceMetadata>
  ): SchemaSnapshot {
    // Build a lookup map for resolving target entity metadata by class reference or class name.
    const entityByTarget = new Map<Function | string, EntityMetadata>();
    for (const e of entities) {
      if (e.target) entityByTarget.set(e.target, e);
      if (e.className) entityByTarget.set(e.className, e);
    }

    // Collect all TableSnapshot entries; use a Map keyed by table name to merge table splitting.
    const tableMap = new Map<string, TableSnapshot>();
    const viewMap = new Map<string, ViewSnapshot>();

    for (const entityMeta of entities) {
      // Keyless entities map to views — skip table DDL; collect view snapshot if DDL supplied.
      if (entityMeta.isKeyless && entityMeta.viewName) {
        if (!viewMap.has(entityMeta.viewName)) {
          viewMap.set(entityMeta.viewName, {
            name: entityMeta.viewName,
            ...(entityMeta.viewSql !== undefined ? { sql: entityMeta.viewSql } : {})
          });
        }
        continue;
      }

      const primaryKeyProps = entityMeta.primaryKeys ?? [];
      const fragments = entityMeta.tableFragments ?? [];

      // Determine which property names are assigned to secondary fragments.
      const fragmentedProps = new Set<string>(fragments.flatMap((f) => f.properties ?? []));

      // Build primary-table columns (exclude fragment-only properties when splitting).
      const primaryColumns: ColumnDef[] = entityMeta.columns
        .filter((col) => fragments.length === 0 || !fragmentedProps.has(col.propertyName))
        .map((column) =>
          this.columnMapper.toSchemaColumn(column, {
            isPrimaryKey: primaryKeyProps.includes(column.propertyName)
          })
        );

      // Per-entity expansion context shared by the schema strategies.
      const ctx: ExpansionContext<TableSnapshot, ColumnDef> = {
        entity: entityMeta,
        entityByType: entityByTarget,
        columns: primaryColumns,
        tables: tableMap,
        columnMapper: this.columnMapper
      };

      // Shadow properties appear as regular columns in DDL (P1-16).
      this.shadowExpander.expand(ctx);

      const primaryKeys = primaryKeyProps.map(
        (pk) => entityMeta.columns.find((column) => column.propertyName === pk)?.columnName || pk
      );
      const indexes = ((entityMeta.indexes || []) as IndexMetadata[]).map((indexDef) => {
        const orders: { [col: string]: 'ASC' | 'DESC' } | undefined = indexDef.isDescending
          ? Object.fromEntries(
              indexDef.columns.map((col, i) => [col, indexDef.isDescending![i] ? 'DESC' : 'ASC'])
            )
          : indexDef.orders;
        return {
          name: indexDef.name,
          columns: indexDef.columns,
          unique: !!indexDef.unique,
          where: indexDef.where,
          orders,
          collations: indexDef.collations,
          nulls: indexDef.nulls,
          expressions: indexDef.expressions,
          using: (indexDef as { using?: 'btree' | 'hash' | 'gin' | 'gist' }).using,
          concurrently: (indexDef as { concurrently?: boolean }).concurrently,
          withParams: (indexDef as { withParams?: Record<string, string | number | boolean> })
            .withParams,
          mysqlVisibility: (indexDef as { mysqlVisibility?: 'VISIBLE' | 'INVISIBLE' })
            .mysqlVisibility,
          include: indexDef.include
        };
      });

      const uniqueConstraints = (entityMeta.alternateKeys ?? []).map((ak) => ({
        name: ak.name,
        columns: ak.columns
      }));

      const foreignKeys = this.foreignKeyResolver.resolve(entityMeta, entityByTarget);

      // Table splitting: merge into existing snapshot when another entity already claimed this table.
      const primaryTableName = entityMeta.tableName;
      const existing = tableMap.get(primaryTableName);
      if (existing) {
        // Merge columns that are not already present (table splitting — shared table).
        for (const col of primaryColumns) {
          if (!existing.columns.some((c) => c.name === col.name)) {
            existing.columns.push(col);
          }
        }
        for (const fk of foreignKeys) {
          if (!existing.foreignKeys.some((f) => f.columns.join() === fk.columns.join())) {
            existing.foreignKeys.push(fk);
          }
        }
      } else {
        tableMap.set(primaryTableName, {
          name: primaryTableName,
          columns: primaryColumns,
          primaryKeys,
          indexes,
          foreignKeys,
          ...(entityMeta.checkConstraints?.length
            ? { checkConstraints: entityMeta.checkConstraints }
            : {}),
          ...(entityMeta.comment !== undefined ? { comment: entityMeta.comment } : {}),
          ...(uniqueConstraints.length > 0 ? { uniqueConstraints } : {})
        });
      }

      // Entity splitting: emit one additional TableSnapshot per fragment.
      this.fragmentExpander.expand(ctx);
    }

    const views = Array.from(viewMap.values());
    const sequenceDefs = this.sequenceExpander.expand(sequences);

    return {
      tables: Array.from(tableMap.values()),
      ...(views.length > 0 ? { views } : {}),
      ...(sequenceDefs.length > 0 ? { sequences: sequenceDefs } : {})
    };
  }

  public async buildActualFromProvider(expected?: SchemaSnapshot): Promise<SchemaSnapshot> {
    if (!this.provider)
      throw new ProviderRequiredError(
        'A database provider is required to build the actual schema',
        {
          details: { operation: 'buildActualFromProvider' }
        }
      );
    const inspector = SchemaInspectorFactory.for(this.provider.providerLabel, this.provider);
    // Mirror expected columns/PKs if provided, and fetch actual indexes.
    const idxFetch = async (table: string): Promise<IndexDef[]> => {
      const list = await inspector.getIndexes(table);
      return list.map((i) => ({
        name: i.name,
        columns: i.columns,
        unique: i.unique,
        where: i.where
      }));
    };
    const tables: TableSnapshot[] = [];
    const source = expected?.tables || [];
    for (const t of source) {
      const indexes = await idxFetch(t.name);
      tables.push({
        name: t.name,
        columns: t.columns.map((c) => ({ name: c.name, type: c.type, nullable: c.nullable })),
        primaryKeys: t.primaryKeys.slice(),
        indexes,
        foreignKeys: []
      });
    }
    return { tables };
  }
}

export class SchemaSnapshotSerializer {
  public serialize(snapshot: SchemaSnapshot): string {
    return JSON.stringify(snapshot, null, 2);
  }

  public deserialize(jsonText: string): SchemaSnapshot {
    let obj: unknown;
    try {
      obj = JSON.parse(jsonText);
    } catch (error) {
      throw new SnapshotSerializationError('Failed to parse SchemaSnapshot JSON', { cause: error });
    }
    this.assertValid(obj);
    return obj;
  }

  private assertValid(obj: unknown): asserts obj is SchemaSnapshot {
    if (!obj || typeof obj !== 'object' || !Array.isArray((obj as { tables?: unknown[] }).tables)) {
      throw new SnapshotValidationError(
        'Invalid SchemaSnapshot: expected an object with a "tables" array property'
      );
    }
  }
}
