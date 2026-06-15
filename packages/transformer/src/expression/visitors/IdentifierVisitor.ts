import * as ts from 'typescript';

import { reportDiagnostic } from '../../diagnostics/DiagnosticSink';
import { makeObject, makeUnsupported, num, prop, str } from '../../nodes/builders';
import type { TransformContext } from '../TransformContext';

export function visit(node: ts.Identifier, tctx: TransformContext, _depth: number): ts.Expression {
  if (node.text === tctx.paramName) {
    reportDiagnostic(
      tctx.sink,
      node,
      `${tctx.methodName}() predicate: bare parameter "${tctx.paramName}" without a property access is not supported. ` +
        `Use ${tctx.paramName}.propertyName instead.`,
      ts.DiagnosticCategory.Error
    );
    // Diagnostic already emitted above; pass methodName only (no sink) to keep the
    // sentinel description method-accurate without double-reporting.
    return makeUnsupported(node, { methodName: tctx.methodName });
  }
  // External variable — capture as ParameterRef
  const idx = tctx.parameters.length;
  tctx.parameters.push(node);
  return makeObject([prop('type', str('parameterRef')), prop('index', num(idx))]);
}
