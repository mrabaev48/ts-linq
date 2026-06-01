import { CallSyntaxEmitter } from '@ts-linq/sql-visitor';
import type { SpCallSyntax } from '@ts-linq/types';

export function createPostgresSpCallSyntax(): SpCallSyntax {
  return new CallSyntaxEmitter('postgres');
}
