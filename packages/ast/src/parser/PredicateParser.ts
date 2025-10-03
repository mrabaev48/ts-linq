import type {
  BinaryExpressionNode,
  ExpressionNode,
  IdentifierNode,
  LiteralNode,
  LogicalExpressionNode
} from '../ast/Nodes';
import { ComparisonOperator, LogicalOperator } from '../ast/Nodes';

/**
 * Lightweight parser that converts supported predicate functions
 * (e.g., a => a.price >= 10 && a.stock > 0) into a minimal AST
 * consumed by an SQL visitor. For unsupported/complex expressions,
 * returns null so the caller can fall back to client-side filtering.
 */
export class PredicateParser<T> {
  private static readonly MAX_LENGTH = 500;
  private static readonly UNSUPPORTED_TOKENS = ['function', '=> {', 'return', '||', '??'];
  /**
   * Attempt to parse a predicate into a minimal AST.
   * Return null when encountering unsupported constructs.
   */
  public parse(predicate: (entity: T) => boolean): ExpressionNode | null {
    const str = predicate.toString();
    if (str.length > PredicateParser.MAX_LENGTH) return null;
    if (PredicateParser.UNSUPPORTED_TOKENS.some((t) => str.includes(t))) return null;
    const arrowIdx = str.indexOf('=>');
    if (arrowIdx === -1) return null;
    const body = str.slice(arrowIdx + 2).trim();
    if (body.includes('&&')) {
      const parts = body.split('&&').map((p) => p.trim());
      const expressions: ExpressionNode[] = [];
      for (const part of parts) {
        const be = this.parseBinary(part);
        if (!be) return null;
        expressions.push(be);
      }
      const node: LogicalExpressionNode = {
        type: 'LogicalExpression',
        operator: LogicalOperator.And,
        expressions
      };
      return node;
    }
    return this.parseBinary(body);
  }

  /**
   * Parse a simple binary comparison like `a.price >= 10`.
   */
  private parseBinary(expr: string): BinaryExpressionNode | null {
    const patterns: Array<{ re: RegExp; op: ComparisonOperator }> = [
      { re: /\w+\.(\w+)\s*===?\s*(.+)/, op: ComparisonOperator.Eq },
      { re: /\w+\.(\w+)\s*>=\s*(.+)/, op: ComparisonOperator.Gte },
      { re: /\w+\.(\w+)\s*<=\s*(.+)/, op: ComparisonOperator.Lte },
      { re: /\w+\.(\w+)\s*>\s*(.+)/, op: ComparisonOperator.Gt },
      { re: /\w+\.(\w+)\s*<\s*(.+)/, op: ComparisonOperator.Lt }
    ];
    for (const { re, op } of patterns) {
      const match = expr.match(re);
      if (match) {
        const idName = match[1];
        if (!/^[_A-Za-z][_\w]*$/.test(idName)) return null;
        const id: IdentifierNode = { type: 'Identifier', name: idName };
        const litRaw = match[2].trim();
        if (/^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*$/.test(litRaw)) {
          return null;
        }
        const parsedValue = this.parseLiteral(litRaw);
        if (parsedValue === undefined && !/^(null)$/i.test(litRaw)) {
          return null;
        }
        const lit: LiteralNode = { type: 'Literal', value: parsedValue ?? null };
        return { type: 'BinaryExpression', left: id, operator: op, right: lit };
      }
    }
    return null;
  }

  /**
   * Parse a literal token into a JS value understood by the SQL visitor.
   */
  private parseLiteral(raw: string): string | number | boolean | null | undefined {
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
      return raw.slice(1, -1);
    }
    const num = Number(raw);
    if (!Number.isNaN(num)) return num;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (raw.toLowerCase() === 'null') return null;
    return undefined;
  }
}
