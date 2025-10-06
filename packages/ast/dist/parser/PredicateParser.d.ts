import type { ExpressionNode } from '../ast/Nodes';
/**
 * Lightweight parser that converts supported predicate functions
 * (e.g., a => a.price >= 10 && a.stock > 0) into a minimal AST
 * consumed by an SQL visitor. For unsupported/complex expressions,
 * returns null so the caller can fall back to client-side filtering.
 */
export declare class PredicateParser<T> {
  private static readonly MAX_LENGTH;
  private static readonly UNSUPPORTED_TOKENS;
  /**
   * Attempt to parse a predicate into a minimal AST.
   * Return null when encountering unsupported constructs.
   */
  parse(predicate: (entity: T) => boolean): ExpressionNode | null;
  /**
   * Parse a simple binary comparison like `a.price >= 10`.
   */
  private parseBinary;
  /**
   * Parse a literal token into a JS value understood by the SQL visitor.
   */
  private parseLiteral;
}
//# sourceMappingURL=PredicateParser.d.ts.map
