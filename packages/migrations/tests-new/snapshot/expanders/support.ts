import type { ColumnMetadata, EntityMetadata } from '@ts-linq/types';

import type { ColumnDef, TableSnapshot } from '../../../src/DiffTypes';
import { ColumnMapper } from '../../../src/snapshot/expanders/ColumnMapper';
import type { ExpansionContext } from '../../../src/snapshot/expanders/EntityExpander';
import type {
  ModelColumnSnapshot,
  ModelTableSnapshot
} from '../../../src/snapshot/model-snapshot.types';

/** Build a minimal `ColumnMetadata` for tests. */
export function col(
  partial: Partial<ColumnMetadata> & { columnName: string; propertyName: string }
): ColumnMetadata {
  return { type: 'TEXT', nullable: true, ...partial } as unknown as ColumnMetadata;
}

/** Build a minimal `EntityMetadata` for tests. */
export function entity(partial: Partial<EntityMetadata>): EntityMetadata {
  return {
    tableName: 'T',
    columns: [],
    primaryKeys: [],
    indexes: [],
    ...partial
  } as unknown as EntityMetadata;
}

/** Build a model-side expansion context. */
export function modelCtx(
  current: EntityMetadata,
  options: {
    related?: EntityMetadata[];
    columns?: ModelColumnSnapshot[];
    tables?: Map<string, ModelTableSnapshot>;
  } = {}
): ExpansionContext<ModelTableSnapshot, ModelColumnSnapshot> {
  const entityByType = new Map<Function | string, EntityMetadata>();
  for (const e of options.related ?? []) {
    if (e.target) entityByType.set(e.target, e);
  }
  return {
    entity: current,
    entityByType,
    columns: options.columns ?? [],
    tables: options.tables ?? new Map<string, ModelTableSnapshot>(),
    columnMapper: new ColumnMapper()
  };
}

/** Build a schema-side expansion context. */
export function schemaCtx(
  current: EntityMetadata,
  options: {
    related?: EntityMetadata[];
    columns?: ColumnDef[];
    tables?: Map<string, TableSnapshot>;
  } = {}
): ExpansionContext<TableSnapshot, ColumnDef> {
  const entityByType = new Map<Function | string, EntityMetadata>();
  for (const e of options.related ?? []) {
    if (e.target) entityByType.set(e.target, e);
    if (e.className) entityByType.set(e.className, e);
  }
  return {
    entity: current,
    entityByType,
    columns: options.columns ?? [],
    tables: options.tables ?? new Map<string, TableSnapshot>(),
    columnMapper: new ColumnMapper()
  };
}
