import { mapPgError } from '../src/pg/ErrorMapper';
import { DatabaseError, ForeignKeyConstraintError, UniqueConstraintError } from '@ts-linq/core';

describe('ErrorMapper (pg -> ts-linq errors)', () => {
  it('maps 23505 to UniqueConstraintError', () => {
    const err = mapPgError({ code: '23505', message: 'duplicate key' });
    expect(err).toBeInstanceOf(UniqueConstraintError);
    expect((err as UniqueConstraintError).code).toBe('23505');
  });

  it('maps 23503 to ForeignKeyConstraintError', () => {
    const err = mapPgError({ code: '23503', message: 'fk violation' });
    expect(err).toBeInstanceOf(ForeignKeyConstraintError);
    expect((err as ForeignKeyConstraintError).code).toBe('23503');
  });

  it('maps unknown to DatabaseError', () => {
    const err = mapPgError({ code: 'XXXXX', message: 'other' });
    expect(err).toBeInstanceOf(DatabaseError);
    expect((err as DatabaseError).code).toBe('XXXXX');
  });
});
