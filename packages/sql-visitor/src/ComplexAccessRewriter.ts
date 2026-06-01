import type { ExpressionNode } from '@ts-linq/ast';
import type { ComplexTypePropertyMetadata } from '@ts-linq/types';

/**
 * Pre-pass rewriter that flattens multi-segment property paths for complex type properties
 * into single-segment PropertyNode names using the "<prefix><field>" convention.
 *
 * Example with default prefix "shippingAddress_":
 *   PropertyNode { path: ['shippingAddress', 'street'] }
 *   → PropertyNode { name: 'shippingAddress_street' }
 *
 * Nested complex types accumulate prefixes:
 *   PropertyNode { path: ['address', 'coords', 'lat'] }
 *   → PropertyNode { name: 'address_coords_lat' } (when coords is nested in address)
 *
 * Single-segment properties are passed through unchanged.
 * Paths that do not start with a known complex property name are passed through unchanged.
 */
export class ComplexAccessRewriter {
  /** Map: top-level property name → ComplexTypePropertyMetadata (for quick lookup). */
  private readonly _complexProps: ReadonlyMap<string, ComplexTypePropertyMetadata>;

  constructor(complexProperties: readonly ComplexTypePropertyMetadata[]) {
    this._complexProps = new Map(complexProperties.map((cp) => [cp.propertyName, cp]));
  }

  rewrite(node: ExpressionNode): ExpressionNode {
    switch (node.type) {
      case 'property': {
        const segments = node.path ?? (node.name ? [node.name] : []);
        if (segments.length < 2) return node;
        const rootProp = segments[0];
        const rootMeta = this._complexProps.get(rootProp);
        if (!rootMeta) return node;
        const flatName = this._resolveFlatName(rootMeta, segments.slice(1));
        return { type: 'property', name: flatName };
      }
      case 'binary':
        return { ...node, left: this.rewrite(node.left), right: this.rewrite(node.right) };
      case 'logical':
        return { ...node, left: this.rewrite(node.left), right: this.rewrite(node.right) };
      case 'not':
        return { ...node, operand: this.rewrite(node.operand) };
      case 'isNull':
      case 'isNotNull': {
        const rewritten = this.rewrite(node.property);
        if (rewritten.type === 'property') return { ...node, property: rewritten };
        return node;
      }
      case 'method': {
        const rewrittenObj = this.rewrite(node.object);
        if (rewrittenObj.type === 'property') return { ...node, object: rewrittenObj };
        return node;
      }
      default:
        return node;
    }
  }

  /**
   * Recursively resolves remaining path segments into a flat column name,
   * descending through nested complex type metadata when applicable.
   */
  private _resolveFlatName(meta: ComplexTypePropertyMetadata, remaining: string[]): string {
    if (remaining.length === 0) return meta.columnPrefix;
    const [head, ...tail] = remaining;
    // Check if head is a nested complex property
    const nestedMeta = meta.nested.find((n) => n.propertyName === head);
    if (nestedMeta && tail.length > 0) {
      return `${meta.columnPrefix}${this._resolveFlatName(nestedMeta, tail)}`;
    }
    // Leaf field — concatenate prefix + field name
    return `${meta.columnPrefix}${remaining.join('_')}`;
  }
}
