import { DatabaseError, UniqueConstraintError } from '@ts-linq/core';

export function mapMssqlError(err: unknown): Error {
  const anyErr = err as { number?: number; message?: string } | undefined;
  const number = anyErr?.number;
  const message = anyErr?.message || String(err);
  if (number === 2627 || number === 2601) return new UniqueConstraintError(message, String(number));
  return new DatabaseError(message, String(number));
}
