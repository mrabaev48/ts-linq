import type * as ts from 'typescript';

import type { DiagnosticSink } from '../diagnostics/DiagnosticSink';
import { hasTypeBrand } from './hasTypeBrand';

const BUILDER_BRAND = '__tsLinqEntityTypeBuilderBrand';

export function receiverIsEntityTypeBuilder(
  checker: ts.TypeChecker,
  receiver: ts.Expression,
  methodName: string,
  sink?: DiagnosticSink
): boolean {
  return hasTypeBrand(checker, receiver, BUILDER_BRAND, methodName, sink);
}
