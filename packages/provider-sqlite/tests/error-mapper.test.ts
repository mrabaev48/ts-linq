import { mapSqliteError } from '../src/sqlite/ErrorMapper';
import { DatabaseError, ForeignKeyConstraintError, UniqueConstraintError } from '@ts-linq/core';

test('maps FK errors to ForeignKeyConstraintError (by message)', () => {
  const e = mapSqliteError({ code: 'SQLITE_CONSTRAINT', message: 'FOREIGN KEY failed' });
  expect(e).toBeInstanceOf(ForeignKeyConstraintError);
});

test('maps unique constraint to UniqueConstraintError', () => {
  expect(mapSqliteError({ code: 'SQLITE_CONSTRAINT_UNIQUE', message: 'unique' })).toBeInstanceOf(
    UniqueConstraintError
  );
});

test('maps unknown to DatabaseError', () => {
  expect(mapSqliteError({ code: 'X', message: 'x' })).toBeInstanceOf(DatabaseError);
});


