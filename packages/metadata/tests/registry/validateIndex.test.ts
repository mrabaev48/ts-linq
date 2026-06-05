import type { ColumnMetadata, IndexMetadata } from '@ts-linq/types';
import { ValidationError } from '@ts-linq/types';

import { validateIndex } from '../../src/registry/validateIndex';

const col = (propertyName: string, columnName = propertyName): ColumnMetadata => ({
  propertyName,
  columnName,
  type: 'INTEGER',
  nullable: false,
  isGenerated: false,
  isVersion: false
});

const index = (name: string, columns: string[]): IndexMetadata => ({ name, columns });

describe('validateIndex — single-source rules', () => {
  const columns = [col('id'), col('email', 'email_address')];

  it('passes for an index over known property names', () => {
    expect(() => validateIndex(index('ix_email', ['email']), [], columns, 'users')).not.toThrow();
  });

  it('passes for an index over known column names', () => {
    expect(() =>
      validateIndex(index('ix_email', ['email_address']), [], columns, 'users')
    ).not.toThrow();
  });

  it('rejects a duplicate index name', () => {
    const existing = [index('ix_email', ['email'])];
    expect(() => validateIndex(index('ix_email', ['id']), existing, columns, 'users')).toThrow(
      ValidationError
    );
    expect(() => validateIndex(index('ix_email', ['id']), existing, columns, 'users')).toThrow(
      "Duplicate index name 'ix_email' on entity 'users'"
    );
  });

  it('rejects unknown columns and lists every missing one', () => {
    expect(() =>
      validateIndex(index('ix_bad', ['email', 'nope', 'missing']), [], columns, 'users')
    ).toThrow("Index 'ix_bad' on entity 'users' references unknown columns: nope, missing");
  });
});
