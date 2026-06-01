import { ExecSyntaxEmitter } from '@ts-linq/sql-visitor';
import type { SpCallSyntax } from '@ts-linq/types';

export function createMssqlSpCallSyntax(): SpCallSyntax {
  return new ExecSyntaxEmitter();
}
