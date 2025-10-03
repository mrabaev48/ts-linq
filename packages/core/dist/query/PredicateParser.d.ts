import type { ExpressionNode } from './ast/Nodes';
/**
 * Very lightweight parser that converts supported predicate functions
 * (e.g., a => a.price >= 10 && a.stock > 0) into a minimal AST
 * consumed by SqlVisitor for SQL generation. For unsupported or
 * complex expressions (variables, function calls), it returns null
 * so the caller can fall back to client-side filtering.
 */
export declare class PredicateParser<T> {
    private static readonly MAX_LENGTH;
    private static readonly UNSUPPORTED_TOKENS;
    /**
     * Attempt to parse a predicate function into a minimal AST.
     * Returns null when encountering unsupported constructs.
     */
    parse(predicate: (entity: T) => boolean): ExpressionNode | null;
    /**
     * Parse a simple binary comparison expression like `a.price >= 10`.
     */
    private parseBinary;
    /**
     * Parse a literal token into a JS value understood by SqlVisitor.
     */
    private parseLiteral;
}
//# sourceMappingURL=PredicateParser.d.ts.map