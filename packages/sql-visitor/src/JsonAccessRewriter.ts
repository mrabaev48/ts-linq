import type { ExpressionNode, JsonPathExpression } from '@ts-linq/ast';
import type { JsonShape } from '@ts-linq/types';

/**
 * Pre-pass visitor that rewrites multi-segment PropertyNode paths into JsonPathExpression
 * when the first path segment maps to a Json-strategy owned property.
 *
 * Example:
 *   PropertyNode { path: ['preferences', 'display', 'theme'] }
 *   → JsonPathExpression { column: 'preferences', path: ['display', 'theme'] }
 *
 * Single-segment properties (regular columns) are passed through unchanged.
 */
export class JsonAccessRewriter {
  constructor(
    /** Map from owner property name → JsonShape for all Json-strategy owned navigations. */
    private readonly jsonOwnedProps: ReadonlyMap<string, JsonShape>
  ) {}

  rewrite(node: ExpressionNode): ExpressionNode {
    switch (node.type) {
      case 'property': {
        const segments = node.path ?? (node.name ? [node.name] : []);
        if (segments.length < 2) return node;
        const rootProp = segments[0];
        const shape = this.jsonOwnedProps.get(rootProp);
        if (!shape) return node;
        const jsonPath: JsonPathExpression = {
          type: 'jsonPath',
          column: shape.columnName,
          path: segments.slice(1)
        };
        return jsonPath;
      }
      case 'binary':
        return {
          ...node,
          left: this.rewrite(node.left),
          right: this.rewrite(node.right)
        };
      case 'logical':
        return {
          ...node,
          left: this.rewrite(node.left),
          right: this.rewrite(node.right)
        };
      case 'not':
        return { ...node, operand: this.rewrite(node.operand) };
      case 'isNull':
      case 'isNotNull': {
        const rewritten = this.rewrite(node.property);
        // A rewritten JSON path is now legal here: the AST field accepts
        // PropertyNode | JsonPathExpression, and NullVisitor renders the path via the dialect's
        // JsonPathTranslator port wrapped in `IS NULL` / `IS NOT NULL`.
        if (rewritten.type === 'property' || rewritten.type === 'jsonPath') {
          return { ...node, property: rewritten };
        }
        return node;
      }
      case 'method': {
        const rewrittenObj = this.rewrite(node.object);
        // Same as above for method (e.g. startsWith → LIKE): MethodVisitor renders a JSON-path
        // object via the translator port wrapped in `LIKE ?`.
        if (rewrittenObj.type === 'property' || rewrittenObj.type === 'jsonPath') {
          return { ...node, object: rewrittenObj };
        }
        return node;
      }
      default:
        return node;
    }
  }
}
