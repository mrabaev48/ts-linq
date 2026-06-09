import { ParameterState, ParameterStyle } from '../../src/ParameterStyle';
import { SqlVisitor } from '../../src/SqlVisitor';
import type { ColumnResolver, ConverterResolver, VisitContext } from '../../src/visitContext';

export interface CtxOverrides {
  inputParameters?: readonly unknown[];
  resolver?: ColumnResolver;
  converterResolver?: ConverterResolver;
  state?: ParameterState;
  recurse?: VisitContext['recurse'];
}

/**
 * Builds a {@link VisitContext} for unit-testing individual node visitors.
 * Defaults mirror the previous positional defaults: empty input parameters, a fresh
 * `ParameterState(Question)`, and a `recurse` that routes back through a plain `SqlVisitor`.
 */
export function makeCtx(overrides: CtxOverrides = {}): VisitContext {
  const inputParameters = overrides.inputParameters ?? [];
  const state = overrides.state ?? new ParameterState(ParameterStyle.Question);
  const recurse = overrides.recurse ?? ((n) => new SqlVisitor().toSql(n, inputParameters));
  return {
    inputParameters,
    resolver: overrides.resolver,
    converterResolver: overrides.converterResolver,
    state,
    recurse
  };
}
