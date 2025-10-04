import { mapMySqlError } from '../src/mysql/ErrorMapper';
import { UniqueConstraintError, DatabaseError } from '@ts-linq/core';

describe('mapMySqlError', () => {
  it('maps ER_DUP_ENTRY to UniqueConstraintError', () => {
    const err = mapMySqlError({ code: 'ER_DUP_ENTRY', message: 'dup' });
    expect(err).toBeInstanceOf(UniqueConstraintError);
    expect((err as any).code).toBe('ER_DUP_ENTRY');
  });
  it('maps unknown to DatabaseError', () => {
    const err = mapMySqlError({ code: 'X', message: 'x' });
    expect(err).toBeInstanceOf(DatabaseError);
  });
});
