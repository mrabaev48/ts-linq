import { DatabaseError, UniqueConstraintError } from '@ts-linq/core';

export function mapMySqlError(err: unknown): Error {
  const anyErr = err as { code?: string; message?: string } | undefined;
  const code = anyErr?.code;
  const message = anyErr?.message || String(err);
  if (code === 'ER_DUP_ENTRY') return new UniqueConstraintError(message, code);
  return new DatabaseError(message, code);
}
