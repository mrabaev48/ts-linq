import { MetadataStorage } from '@ts-linq/metadata';
import type { ColumnMetadata, EntityMetadata } from '@ts-linq/types';

/**
 * Shared fixtures for the dialect contract matrix. Every dialect is exercised with these *identical*
 * inputs so that any structural divergence in the produced SQL is surfaced as a golden diff.
 */

/** Entity used for the `buildSelect` matrix. `buildSelect` resolves its table via `MetadataStorage`. */
export class ContractEntity {
  id!: number;
  name!: string;
}

/** Table name the select matrix expects for {@link ContractEntity}. */
export const CONTRACT_TABLE = 'test_table';

/** Register {@link ContractEntity} in the global metadata storage (required by `buildSelect`). */
export function registerContractEntity(): void {
  MetadataStorage.getInstance().clear();
  MetadataStorage.addEntity(ContractEntity, CONTRACT_TABLE);
  MetadataStorage.addColumn(ContractEntity, {
    propertyName: 'id',
    columnName: 'id',
    type: 'INTEGER',
    nullable: false
  });
  MetadataStorage.addColumn(ContractEntity, {
    propertyName: 'name',
    columnName: 'name',
    type: 'TEXT',
    nullable: true
  });
  MetadataStorage.addPrimaryKey(ContractEntity, 'id');
}

/** Clear the global metadata storage after the select matrix runs. */
export function clearContractEntity(): void {
  MetadataStorage.getInstance().clear();
}

/** Helper to build a fully-formed {@link EntityMetadata} without repeating empty collections. */
function entity(
  tableName: string,
  columns: ColumnMetadata[],
  primaryKeys: string[]
): EntityMetadata {
  return { tableName, primaryKeys, columns, relationships: [], indexes: [] };
}

function col(
  overrides: Partial<ColumnMetadata> & Pick<ColumnMetadata, 'propertyName' | 'columnName'>
): ColumnMetadata {
  return { type: 'TEXT', ...overrides };
}

// ── INSERT fixtures (users: generated id + name/email, plus a computed variant) ────────────────

/** INSERT metadata: generated PK `id`, plain `name`/`email`. */
export const insertMeta: EntityMetadata = entity(
  'users',
  [
    col({ propertyName: 'id', columnName: 'id', type: 'INT', primaryKey: true, isGenerated: true }),
    col({ propertyName: 'name', columnName: 'name' }),
    col({ propertyName: 'email', columnName: 'email' })
  ],
  ['id']
);

/** INSERT metadata with a computed column — captures the MySQL/PG-exclude vs MSSQL-include divergence. */
export const insertComputedMeta: EntityMetadata = entity(
  'users',
  [
    col({ propertyName: 'id', columnName: 'id', type: 'INT', primaryKey: true, isGenerated: true }),
    col({ propertyName: 'name', columnName: 'name' }),
    col({ propertyName: 'fullName', columnName: 'full_name', isComputed: true })
  ],
  ['id']
);

// ── UPDATE / DELETE fixtures (articles: id + title + version) ──────────────────────────────────

const articleTitleTokenCol: ColumnMetadata = col({
  propertyName: 'title',
  columnName: 'title',
  isConcurrencyToken: true
});

const articleVersionCol: ColumnMetadata = col({
  propertyName: 'version',
  columnName: 'version',
  type: 'INT',
  isVersion: true,
  isConcurrencyToken: true
});

/** UPDATE/DELETE metadata without concurrency handling (plain id + title). */
export const writeMeta: EntityMetadata = entity(
  'articles',
  [
    col({ propertyName: 'id', columnName: 'id', type: 'INT', primaryKey: true }),
    col({ propertyName: 'title', columnName: 'title' })
  ],
  ['id']
);

/** UPDATE/DELETE metadata whose `title` is a non-version concurrency token. */
export const tokenMeta: EntityMetadata = entity(
  'articles',
  [
    col({ propertyName: 'id', columnName: 'id', type: 'INT', primaryKey: true }),
    articleTitleTokenCol
  ],
  ['id']
);

/** UPDATE metadata carrying a rowversion column. */
export const versionMeta: EntityMetadata = entity(
  'articles',
  [
    col({ propertyName: 'id', columnName: 'id', type: 'INT', primaryKey: true }),
    col({ propertyName: 'title', columnName: 'title' }),
    articleVersionCol
  ],
  ['id']
);

export const titleToken = articleTitleTokenCol;
export const versionColumn = articleVersionCol;

// ── BATCH fixtures (users: generated id + name/email) ──────────────────────────────────────────

/** BATCH metadata: generated PK `id`, plain `name`/`email`. */
export const batchMeta: EntityMetadata = insertMeta;

/** BATCH metadata whose PK is *not* generated (drives the MSSQL "omit OUTPUT" branch). */
export const batchNonGeneratedPkMeta: EntityMetadata = entity(
  'users',
  [
    col({
      propertyName: 'id',
      columnName: 'id',
      type: 'INT',
      primaryKey: true,
      isGenerated: false
    }),
    col({ propertyName: 'name', columnName: 'name' }),
    col({ propertyName: 'email', columnName: 'email' })
  ],
  ['id']
);
