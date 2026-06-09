import type { JsonPathExpression } from '@ts-linq/ast';

import type { ParameterState } from '../ParameterStyle';
import type { ConditionFragment, SqlFragment } from '../types';
import type { NodeVisitor, VisitContext } from '../visitContext';

/**
 * Dialect-specific translator for JsonPathExpression → SQL fragment.
 * Implement this interface in each dialect package.
 */
export interface JsonPathTranslator {
  translate(node: JsonPathExpression, state: ParameterState): SqlFragment;
}

/**
 * Wraps a JsonPathExpression into a ConditionFragment suitable for use in WHERE clauses.
 * The fragment is the raw SQL expression — the caller is responsible for wrapping
 * it in a comparison (e.g. `= ?`).
 */
export class JsonPathVisitor implements NodeVisitor<JsonPathExpression> {
  constructor(private readonly translator: JsonPathTranslator) {}

  public visit(node: JsonPathExpression, ctx: VisitContext): ConditionFragment {
    const { fragment, params } = this.translator.translate(node, ctx.state);
    return { condition: fragment, parameters: params };
  }
}
