import {
  type InsertableColumnOptions,
  selectInsertableColumns,
  selectUpdatableColumns
} from '@ts-linq/dialect-kit';
import type { ColumnMetadata, EntityMetadata } from '@ts-linq/types';

function col(
  overrides: Partial<ColumnMetadata> & Pick<ColumnMetadata, 'propertyName' | 'columnName'>
): ColumnMetadata {
  return { type: 'TEXT', ...overrides };
}

/** Entity: generated PK `id`, plain `name`, computed `full`. */
const metadata: EntityMetadata = {
  tableName: 't',
  primaryKeys: ['id'],
  columns: [
    col({ propertyName: 'id', columnName: 'id', type: 'INT', primaryKey: true, isGenerated: true }),
    col({ propertyName: 'name', columnName: 'name' }),
    col({ propertyName: 'full', columnName: 'full', isComputed: true })
  ],
  relationships: [],
  indexes: []
};

/** Entity whose PK is a natural (non-generated) key, to exercise `excludeGeneratedPk`. */
const naturalPkMeta: EntityMetadata = {
  tableName: 't',
  primaryKeys: ['id'],
  columns: [
    col({ propertyName: 'id', columnName: 'id', type: 'INT', primaryKey: true }),
    col({ propertyName: 'name', columnName: 'name' })
  ],
  relationships: [],
  indexes: []
};

const names = (cols: ColumnMetadata[]): string[] => cols.map((c) => c.propertyName);

describe('selectInsertableColumns', () => {
  const policyAll: InsertableColumnOptions = { excludeComputed: true, excludeGeneratedPk: true };

  it('excludes a generated PK that has no supplied value', () => {
    expect(names(selectInsertableColumns(metadata, { name: 'a' }, policyAll))).toEqual(['name']);
  });

  it('keeps a generated PK when a value is explicitly supplied', () => {
    expect(names(selectInsertableColumns(metadata, { id: 9, name: 'a' }, policyAll))).toEqual([
      'id',
      'name'
    ]);
  });

  it('excludes computed columns when excludeComputed is true', () => {
    expect(names(selectInsertableColumns(metadata, { name: 'a', full: 'x' }, policyAll))).toEqual([
      'name'
    ]);
  });

  it('keeps computed columns when excludeComputed is false', () => {
    const policy: InsertableColumnOptions = { excludeComputed: false, excludeGeneratedPk: true };
    expect(names(selectInsertableColumns(metadata, { name: 'a', full: 'x' }, policy))).toEqual([
      'name',
      'full'
    ]);
  });

  it('excludeGeneratedPk omits an unset non-generated PK; disabling keeps it', () => {
    const withHeuristic: InsertableColumnOptions = {
      excludeComputed: true,
      excludeGeneratedPk: true
    };
    const withoutHeuristic: InsertableColumnOptions = {
      excludeComputed: true,
      excludeGeneratedPk: false
    };
    expect(names(selectInsertableColumns(naturalPkMeta, { name: 'a' }, withHeuristic))).toEqual([
      'name'
    ]);
    expect(names(selectInsertableColumns(naturalPkMeta, { name: 'a' }, withoutHeuristic))).toEqual([
      'id',
      'name'
    ]);
  });

  it('treats an explicit null value as "no value"', () => {
    expect(
      names(selectInsertableColumns(naturalPkMeta, { id: null, name: 'a' }, policyAll))
    ).toEqual(['name']);
  });
});

describe('selectUpdatableColumns', () => {
  it('excludes primary keys, generated and computed columns', () => {
    expect(names(selectUpdatableColumns(metadata))).toEqual(['name']);
  });
});
