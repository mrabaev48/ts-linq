import { describe, expect, it } from '@jest/globals';
import type { ColumnMetadata, ShadowPropertyMetadata, ValueConverterLike } from '@ts-linq/types';

import { ColumnMapper } from '../../../src/snapshot/expanders/ColumnMapper';
import { col } from './support';

describe('ColumnMapper', () => {
  const mapper = new ColumnMapper();

  it('projects a model column with raw uppercased type and carries defaults', () => {
    const c = col({
      columnName: 'title',
      propertyName: 'title',
      type: 'varchar',
      nullable: false,
      defaultValue: 'Untitled',
      defaultExpression: 'now()'
    });

    const m = mapper.toModelColumn(c, { isPrimaryKey: true });
    expect(m).toEqual({
      name: 'title',
      type: 'VARCHAR',
      nullable: false,
      isPrimaryKey: true,
      defaultValue: 'Untitled',
      defaultExpression: 'now()'
    });
  });

  it('applies name prefix and nullable override for model columns', () => {
    const c = col({ columnName: 'city', propertyName: 'city', type: 'TEXT', nullable: true });
    const m = mapper.toModelColumn(c, { namePrefix: 'shipping_', nullable: false });
    expect(m.name).toBe('shipping_city');
    expect(m.nullable).toBe(false);
    expect(m.isPrimaryKey).toBe(false);
  });

  it('projects a schema column with portable type mapping', () => {
    const c = col({ columnName: 'qty', propertyName: 'qty', type: 'NUMBER', nullable: false });
    const s = mapper.toSchemaColumn(c, { isPrimaryKey: true });
    expect(s.name).toBe('qty');
    expect(s.type).toBe('INTEGER'); // NUMBER → INTEGER (portable)
    expect(s.nullable).toBe(false);
    expect(s.isPrimaryKey).toBe(true);
  });

  it('runs the value converter over the schema default value', () => {
    const converter: ValueConverterLike = {
      toProvider: (v: unknown) => (v === true ? 1 : 0),
      fromProvider: (v: unknown) => v === 1
    } as unknown as ValueConverterLike;
    const c = col({
      columnName: 'active',
      propertyName: 'active',
      type: 'BOOLEAN',
      defaultValue: true,
      converter
    });
    const s = mapper.toSchemaColumn(c);
    expect(s.defaultValue).toBe(1);
    expect(s.type).toBe('INTEGER'); // BOOLEAN → INTEGER
  });

  it('shares a single portable-type mapping for shadow columns', () => {
    const sp = {
      propertyName: 'createdAt',
      columnName: 'created_at',
      type: 'DATETIME',
      nullable: false,
      comment: 'audit'
    } as unknown as ShadowPropertyMetadata;
    const s = mapper.toSchemaShadowColumn(sp);
    expect(s).toEqual({
      name: 'created_at',
      type: 'TEXT', // DATETIME → TEXT (portable)
      nullable: false,
      defaultValue: undefined,
      defaultExpression: undefined,
      comment: 'audit'
    });
  });

  it('model and schema paths agree on name / nullability for the same column (single source)', () => {
    const c: ColumnMetadata = col({
      columnName: 'note',
      propertyName: 'note',
      type: 'TEXT',
      nullable: true
    });
    const m = mapper.toModelColumn(c);
    const s = mapper.toSchemaColumn(c);
    expect(s.name).toBe(m.name);
    expect(s.nullable).toBe(m.nullable);
  });
});
