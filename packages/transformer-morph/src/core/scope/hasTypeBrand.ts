import * as ts from 'typescript';

import type { DiagnosticSink } from '../diagnostics/DiagnosticSink';
import { reportDiagnostic } from '../diagnostics/DiagnosticSink';

/**
 * Shared branded-type check used by every scope guard.
 *
 * Returns `true` iff `receiver`'s type carries the marker property `brand`. A receiver
 * that is provably *not* branded returns `false` silently — that is a legitimate
 * non-match and must not produce noise. Only a thrown `TypeChecker` call (an incomplete
 * type graph, a checker edge case) emits a {@link ts.DiagnosticCategory.Warning}: the
 * rewrite is skipped either way, but routing the failure through the sink makes the skip
 * observable at build time instead of surfacing later as the misleading runtime stub
 * error ("compile-time transformer is required ...").
 *
 * The function still returns `false` on a caught error so the compilation does not crash.
 */
export function hasTypeBrand(
  checker: ts.TypeChecker,
  receiver: ts.Expression,
  brand: string,
  methodName: string,
  sink?: DiagnosticSink
): boolean {
  try {
    const type = checker.getTypeAtLocation(receiver);
    const props = checker.getPropertiesOfType(type);
    // Unbranded receiver → `false` with no diagnostic (a genuine, expected non-match).
    return props.some((p) => p.getName() === brand);
  } catch {
    reportDiagnostic(
      sink,
      receiver,
      `Could not resolve the receiver type for \`${methodName}\`; ` +
        `the query was left un-rewritten and will throw at runtime.`,
      ts.DiagnosticCategory.Warning
    );
    return false;
  }
}
