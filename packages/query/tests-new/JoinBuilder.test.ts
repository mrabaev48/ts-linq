/**
 * Unit tests for {@link JoinBuilder} — the structured-join-clause builder extracted from `Queryable`
 * (refactor query/task-1). Lambda keys are converted to strings by `extractKey` on the facade
 * (covered by extractKey.test.ts), so the builder always receives resolved string keys.
 */
import { MetadataStorage } from '@ts-linq/metadata';
import { MetadataError } from '@ts-linq/types';

import { JoinBuilder } from '../src/JoinBuilder';

class JbBook {
  id!: number;
  authorId!: number;
}

class JbAuthor {
  id!: number;
}

class JbUnregistered {}

beforeAll(() => {
  MetadataStorage.addEntity(JbBook, 'books');
  MetadataStorage.addColumn(JbBook, { propertyName: 'id', columnName: 'id', type: 'INTEGER' });
  MetadataStorage.addColumn(JbBook, {
    propertyName: 'authorId',
    columnName: 'author_id',
    type: 'INTEGER'
  });
  MetadataStorage.addEntity(JbAuthor, 'authors');
  MetadataStorage.addColumn(JbAuthor, { propertyName: 'id', columnName: 'id', type: 'INTEGER' });
});

describe('JoinBuilder', () => {
  const builder = new JoinBuilder();

  it('maps property names to column names and emits a structured INNER equi-join', () => {
    const clause = builder.build('INNER', JbBook, JbAuthor, 'authorId', 'id');
    expect(clause).toEqual({
      type: 'INNER',
      table: 'authors',
      onColumns: [
        {
          left: { table: 'books', column: 'author_id' },
          right: { table: 'authors', column: 'id' }
        }
      ],
      alias: undefined
    });
  });

  it('honors the join type and alias', () => {
    const clause = builder.build('LEFT', JbBook, JbAuthor, 'authorId', 'id', 'a');
    expect(clause.type).toBe('LEFT');
    expect(clause.alias).toBe('a');
  });

  it('falls back to the raw key when no column mapping exists', () => {
    const clause = builder.build('INNER', JbBook, JbAuthor, 'missingProp', 'id');
    expect(clause.onColumns?.[0].left.column).toBe('missingProp');
  });

  it('throws a typed MetadataError when entity metadata is missing', () => {
    expect(() => builder.build('INNER', JbUnregistered, JbAuthor, 'x', 'id')).toThrow(
      'ts-linq: entity metadata not found for join'
    );
    expect(() => builder.build('INNER', JbUnregistered, JbAuthor, 'x', 'id')).toThrow(
      MetadataError
    );
  });
});
