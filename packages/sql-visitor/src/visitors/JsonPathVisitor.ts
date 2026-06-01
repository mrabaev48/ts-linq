import type { JsonPathNode } from '@ts-linq/ast';
import type { ConditionFragment, SqlFragment } from '@ts-linq/ast';

import type { ParameterState } from '../ParameterStyle';

/**
 * Dialect-specific translator for JsonPathNode → SQL fragment.
 * Implement this interface in each dialect package.
 */
export interface JsonPathTranslator {
  translate(node: JsonPathNode, state: ParameterState): SqlFragment;
}

/**
 * Wraps a JsonPathNode into a ConditionFragment suitable for use in WHERE clauses.
 * The fragment is the raw SQL expression — the caller is responsible for wrapping
 * it in a comparison (e.g. `= ?`).
 */
export class JsonPathVisitor {
  constructor(private readonly translator: JsonPathTranslator) {}

  visit(node: JsonPathNode, state: ParameterState): ConditionFragment {
    const { fragment, params } = this.translator.translate(node, state);
    return { condition: fragment, parameters: params };
  }
}
