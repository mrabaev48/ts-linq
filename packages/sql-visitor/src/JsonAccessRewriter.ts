import type { ExpressionNode, JsonPathExpression } from '@ts-linq/ast';
import { AstSqlGenerationError } from '@ts-linq/ast';
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
        if (rewritten.type === 'property') return { ...node, property: rewritten };
        // A JSON path cannot legally sit in an isNull/isNotNull position: the AST types it as
        // PropertyNode and no dialect translator emits JSON-path IS NULL. Fail loud instead of
        // silently dropping the rewrite and emitting SQL against a non-existent column.
        throw this.unsupportedJsonPosition(node.type, rewritten);
      }
      case 'method': {
        const rewrittenObj = this.rewrite(node.object);
        if (rewrittenObj.type === 'property') return { ...node, object: rewrittenObj };
        // Same as above for method (e.g. startsWith → LIKE): no dialect supports a JSON path here.
        throw this.unsupportedJsonPosition(node.type, rewrittenObj);
      }
      default:
        return node;
    }
  }

  /**
   * Builds a typed error for a JSON path that resolved into a node position no dialect
   * supports (isNull/isNotNull/method). Converges both fail-loud branches onto one shape.
   */
  private unsupportedJsonPosition(
    position: 'isNull' | 'isNotNull' | 'method',
    rewritten: ExpressionNode
  ): AstSqlGenerationError {
    const json = rewritten.type === 'jsonPath' ? rewritten : undefined;
    return new AstSqlGenerationError(
      'UNSUPPORTED_JSON_POSITION',
      `JSON path in '${position}' position is not supported by any dialect. ` +
        'Use a scalar property, or compare the JSON value directly (=== / !== null).',
      { nodeType: position, column: json?.column, path: json?.path }
    );
  }
}
