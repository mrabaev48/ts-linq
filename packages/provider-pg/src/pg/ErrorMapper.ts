import { DatabaseError, ForeignKeyConstraintError, UniqueConstraintError } from '@ts-linq/core';

export function mapPgError(err: unknown): Error {
  const anyErr = err as { code?: string; message?: string } | undefined;
  const code = anyErr?.code;
  const message = anyErr?.message || String(err);
  if (code === '23505') return new UniqueConstraintError(message, code);
  if (code === '23503') return new ForeignKeyConstraintError(message, code);
  return new DatabaseError(message, code);
}
