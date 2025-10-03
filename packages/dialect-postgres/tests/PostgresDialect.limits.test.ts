import { PostgresDialect } from '../src';
import { MetadataStorage } from '@ts-linq/core';

class E {
  id!: number;
}

beforeAll(() => {
  MetadataStorage.addEntity(E, 'e');
  MetadataStorage.addColumn(E, {
    propertyName: 'id',
    columnName: 'id',
    type: 'INTEGER',
    nullable: false,
    isGenerated: true
  });
});

describe('PostgresDialect limit/offset', () => {
  const d = new PostgresDialect();

  it('no limit/offset renders none', () => {
    const { query } = d.buildSelect(E, {} as any);
    expect(query.endsWith('"e"')).toBeTruthy();
  });

  it('limit only renders LIMIT', () => {
    const { query } = d.buildSelect(E, { limit: 10 } as any);
    expect(query.endsWith(' LIMIT 10')).toBeTruthy();
  });

  it('offset only renders OFFSET', () => {
    const { query } = d.buildSelect(E, { offset: 5 } as any);
    expect(query.endsWith(' OFFSET 5')).toBeTruthy();
  });

  it('limit+offset renders both', () => {
    const { query } = d.buildSelect(E, { limit: 10, offset: 5 } as any);
    expect(query.endsWith(' LIMIT 10 OFFSET 5')).toBeTruthy();
  });
});
