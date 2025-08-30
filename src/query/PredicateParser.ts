import { BinaryExpressionNode, ComparisonOperator, ExpressionNode, IdentifierNode, LiteralNode, LogicalExpressionNode, LogicalOperator } from './ast/Nodes';

/**
 * Very lightweight parser that converts supported predicate functions
 * (e.g., a => a.price >= 10 && a.stock > 0) into a minimal AST
 * consumed by SqlVisitor for SQL generation. For unsupported or
 * complex expressions (variables, function calls), it returns null
 * so the caller can fall back to client-side filtering.
 */
export class PredicateParser<T> {
    /**
     * Attempt to parse a predicate function into a minimal AST.
     * Returns null when encountering unsupported constructs.
     */
    public parse(predicate: (entity: T) => boolean): ExpressionNode | null {
        const str = predicate.toString();
        // crude parse: handle a => a.prop op literal and && chains
        const arrowIdx = str.indexOf('=>');
        if (arrowIdx === -1) return null;
        const body = str.slice(arrowIdx + 2).trim();
        if (body.includes('&&')) {
            const parts = body.split('&&').map(p => p.trim());
            const expressions: ExpressionNode[] = [];
            for (const part of parts) {
                const be = this.parseBinary(part);
                if (!be) return null;
                expressions.push(be);
            }
            const node: LogicalExpressionNode = { type: 'LogicalExpression', operator: LogicalOperator.And, expressions };
            return node;
        }
        return this.parseBinary(body);
    }

    /**
     * Parse a simple binary comparison expression like `a.price >= 10`.
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
            const m = expr.match(re);
            if (m) {
                const id: IdentifierNode = { type: 'Identifier', name: m[1] };
                const litRaw = m[2].trim();
                // If right side looks like an identifier (variable), bail out to fallback
                if (/^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*$/.test(litRaw)) {
                    return null;
                }
                const parsedValue = this.parseLiteral(litRaw);
                // If couldn't parse to a primitive literal, bail out
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
     * Parse a literal token into a JS value understood by SqlVisitor.
     */
    private parseLiteral(raw: string): any {
        if ((raw.startsWith('\"') && raw.endsWith('\"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
            return raw.slice(1, -1);
        }
        const num = Number(raw);
        if (!Number.isNaN(num)) return num;
        if (raw === 'true') return true;
        if (raw === 'false') return false;
        if (raw.toLowerCase() === 'null') return null;
        // Unknown token – indicate unparsed
        return undefined as any;
    }
}


