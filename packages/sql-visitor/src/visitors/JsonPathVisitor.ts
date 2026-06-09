import type { JsonPathExpression } from '@ts-linq/ast';

import type { ParameterState } from '../ParameterStyle';
import type { ConditionFragment, SqlFragment } from '../types';

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
export class JsonPathVisitor {
  constructor(private readonly translator: JsonPathTranslator) {}

  visit(node: JsonPathExpression, state: ParameterState): ConditionFragment {
    const { fragment, params } = this.translator.translate(node, state);
    return { condition: fragment, parameters: params };
  }
}
