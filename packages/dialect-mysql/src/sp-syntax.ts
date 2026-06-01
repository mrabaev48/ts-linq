import { CallSyntaxEmitter } from '@ts-linq/sql-visitor';
import type { SpCallSyntax } from '@ts-linq/types';

export function createMysqlSpCallSyntax(): SpCallSyntax {
  return new CallSyntaxEmitter('mysql');
}
