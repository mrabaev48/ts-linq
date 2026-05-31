import type { DatabaseProvider } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import type {
  ColumnMetadata,
  EntityMetadata,
  IndexMetadata,
  RelationshipMetadata
} from '@ts-linq/types';

import { deleteBehaviorToSql } from './builders/handlers/ForeignKeyHandlers';
import type {
  ColumnDef,
  ForeignKeyDef,
  IndexDef,
  SchemaSnapshot,
  TableSnapshot
} from './DiffTypes';
import {
  MssqlSchemaInspector,
  MySqlSchemaInspector,
  PostgresSchemaInspector
} from './SchemaInspector';

/**
 * OOP builders/serializers for SchemaSnapshot with thin functional wrappers for back-compat.
 */
export class SchemaSnapshotBuilder {
  private readonly provider?: DatabaseProvider;

  constructor(provider?: DatabaseProvider) {
    this.provider = provider;
  }

  public buildExpectedFromMetadata(): SchemaSnapshot {
    const entities = MetadataStorage.getEntities();

    // Build a lookup map for resolving target entity metadata by class reference or class name.
    const entityByTarget = new Map<Function | string, EntityMetadata>();
    for (const e of entities) {
      if (e.target) entityByTarget.set(e.target, e);
      if (e.className) entityByTarget.set(e.className, e);
    }

    const tables: TableSnapshot[] = entities.map((entityMeta: EntityMetadata) => {
      const primaryKeyProps = entityMeta.primaryKeys ?? [];
      const columns: ColumnDef[] = entityMeta.columns.map((column: ColumnMetadata) => ({
        name: column.columnName,
        type: this.mapPortableType(column.type),
        nullable: column.nullable ?? true,
        defaultValue:
          column.converter && column.defaultValue !== undefined
            ? column.converter.toProvider(column.defaultValue)
            : column.defaultValue,
        defaultExpression: column.defaultExpression,
        isPrimaryKey: primaryKeyProps.includes(column.propertyName),
        isComputed: column.isComputed,
        computedExpression: column.computedExpression,
        computedStorage: column.computedStorage,
        comment: column.comment
      }));
      const primaryKeys = primaryKeyProps.map(
        (pk) => entityMeta.columns.find((column) => column.propertyName === pk)?.columnName || pk
      );
      const indexes = ((entityMeta.indexes || []) as IndexMetadata[]).map((indexDef) => ({
        name: indexDef.name,
        columns: indexDef.columns,
        unique: !!indexDef.unique,
        where: indexDef.where,
        orders: indexDef.orders,
        collations: indexDef.collations,
        nulls: indexDef.nulls,
        expressions: indexDef.expressions,
        using: (indexDef as { using?: 'btree' | 'hash' | 'gin' | 'gist' }).using,
        concurrently: (indexDef as { concurrently?: boolean }).concurrently,
        withParams: (indexDef as { withParams?: Record<string, string | number | boolean> })
          .withParams,
        mysqlVisibility: (indexDef as { mysqlVisibility?: 'VISIBLE' | 'INVISIBLE' })
          .mysqlVisibility,
        include: (indexDef as { include?: string[] }).include
      }));

      const foreignKeys = this.buildForeignKeys(entityMeta, entityByTarget);

      return {
        name: entityMeta.tableName,
        columns,
        primaryKeys,
        indexes,
        foreignKeys,
        ...(entityMeta.checkConstraints?.length
          ? { checkConstraints: entityMeta.checkConstraints }
          : {}),
        ...(entityMeta.comment !== undefined ? { comment: entityMeta.comment } : {})
      };
    });
    return { tables };
  }

  private buildForeignKeys(
    entityMeta: EntityMetadata,
    entityByTarget: Map<Function | string, EntityMetadata>
  ): ForeignKeyDef[] {
    const fks: ForeignKeyDef[] = [];
    for (const rel of entityMeta.relationships ?? []) {
      // Only the dependent side (many-to-one / one-to-one with foreignKey) owns the FK column.
      if (rel.type !== 'many-to-one' && rel.type !== 'one-to-one') continue;
      if (!rel.foreignKey) continue;

      const targetMeta = this.resolveTargetMeta(rel, entityByTarget);
      if (!targetMeta) continue;

      const refPkProps = targetMeta.primaryKeys ?? [];
      if (refPkProps.length === 0) continue;

      const refColumns = refPkProps
        .map((pk) => targetMeta.columns.find((c) => c.propertyName === pk)?.columnName ?? pk)
        .filter(Boolean);

      if (refColumns.length === 0) continue;

      const fk: ForeignKeyDef = {
        columns: [rel.foreignKey],
        refTable: targetMeta.tableName,
        refColumns
      };

      if (rel.onDelete) {
        const clause = deleteBehaviorToSql(rel.onDelete);
        if (clause) fk.onDelete = clause;
      }

      fks.push(fk);
    }
    return fks;
  }

  private resolveTargetMeta(
    rel: RelationshipMetadata,
    entityByTarget: Map<Function | string, EntityMetadata>
  ): EntityMetadata | undefined {
    const { targetEntity } = rel;
    if (!targetEntity) return undefined;
    if (typeof targetEntity === 'function') {
      // Could be the class itself or a lazy factory (() => Class).
      const direct = entityByTarget.get(targetEntity);
      if (direct) return direct;
      // Try calling it as a factory.
      try {
        const resolved = (targetEntity as () => Function)();
        if (resolved) return entityByTarget.get(resolved);
      } catch {
        // Not a factory, ignore.
      }
    }
    if (typeof targetEntity === 'string') {
      return entityByTarget.get(targetEntity);
    }
    return undefined;
  }

  public async buildActualFromProvider(expected?: SchemaSnapshot): Promise<SchemaSnapshot> {
    if (!this.provider)
      throw new Error('SchemaSnapshotBuilder requires a provider for actual schema');
    const label = this.provider.providerLabel;
    // Mirror expected columns/PKs if provided, and fetch actual indexes.
    const idxFetch = async (table: string): Promise<IndexDef[]> => {
      if (label === 'postgresql') {
        const ins = new PostgresSchemaInspector(this.provider!);
        const list = await ins.getIndexes(table);
        return list.map((i) => ({
          name: i.name,
          columns: i.columns,
          unique: i.unique,
          where: i.where
        }));
      }
      if (label === 'mysql') {
        const ins = new MySqlSchemaInspector(this.provider!);
        const list = await ins.getIndexes(table);
        return list.map((i) => ({ name: i.name, columns: i.columns, unique: i.unique }));
      }
      if (label === 'mssql') {
        const ins = new MssqlSchemaInspector(this.provider!);
        const list = await ins.getIndexes(table);
        return list.map((i) => ({
          name: i.name,
          columns: i.columns,
          unique: i.unique,
          where: i.where
        }));
      }
      return [];
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

  private mapPortableType(type: string): string {
    switch (String(type || '').toUpperCase()) {
      case 'INTEGER':
      case 'NUMBER':
        return 'INTEGER';
      case 'REAL':
      case 'FLOAT':
      case 'DOUBLE':
        return 'REAL';
      case 'BOOLEAN':
        return 'INTEGER';
      case 'DATETIME':
      case 'DATE':
        return 'TEXT';
      case 'BLOB':
        return 'BLOB';
      default:
        return 'TEXT';
    }
  }

  private normalizePortableType(type: string): string {
    return this.mapPortableType(type);
  }
}

export class SchemaSnapshotSerializer {
  public serialize(snapshot: SchemaSnapshot): string {
    return JSON.stringify(snapshot, null, 2);
  }

  public deserialize(jsonText: string): SchemaSnapshot {
    const obj = JSON.parse(jsonText);
    this.assertValid(obj);
    return obj;
  }

  private assertValid(obj: unknown): asserts obj is SchemaSnapshot {
    if (!obj || typeof obj !== 'object' || !Array.isArray((obj as { tables?: unknown[] }).tables)) {
      throw new Error('Invalid SchemaSnapshot JSON');
    }
  }
}
