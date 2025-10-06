import { mapMssqlError } from '../src/mssql/ErrorMapper';
import { UniqueConstraintError, DatabaseError } from '@ts-linq/core';

test('maps 2627/2601 to UniqueConstraintError', () => {
  const e2627 = mapMssqlError({ number: 2627, message: 'dup' });
  const e2601 = mapMssqlError({ number: 2601, message: 'dup' });
  expect(e2627).toBeInstanceOf(UniqueConstraintError);
  expect(e2601).toBeInstanceOf(UniqueConstraintError);
});

test('maps unknown to DatabaseError', () => {
  const e = mapMssqlError({ number: 1, message: 'x' });
  expect(e).toBeInstanceOf(DatabaseError);
});
