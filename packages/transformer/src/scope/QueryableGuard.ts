import type * as ts from 'typescript';

import type { DiagnosticSink } from '../diagnostics/DiagnosticSink';
import { hasTypeBrand } from './hasTypeBrand';

const BRAND = '__tsLinqWhereTransformerBrand';

export function receiverIsQueryable(
  checker: ts.TypeChecker,
  receiver: ts.Expression,
  methodName: string,
  sink?: DiagnosticSink
): boolean {
  return hasTypeBrand(checker, receiver, BRAND, methodName, sink);
}
