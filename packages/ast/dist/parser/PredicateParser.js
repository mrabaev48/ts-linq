"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PredicateParser = void 0;
const Nodes_1 = require("../ast/Nodes");
/**
 * Lightweight parser that converts supported predicate functions
 * (e.g., a => a.price >= 10 && a.stock > 0) into a minimal AST
 * consumed by an SQL visitor. For unsupported/complex expressions,
 * returns null so the caller can fall back to client-side filtering.
 */
class PredicateParser {
    /**
     * Attempt to parse a predicate into a minimal AST.
     * Return null when encountering unsupported constructs.
     */
    parse(predicate) {
        const str = predicate.toString();
        if (str.length > PredicateParser.MAX_LENGTH)
            return null;
        if (PredicateParser.UNSUPPORTED_TOKENS.some((t) => str.includes(t)))
            return null;
        const arrowIdx = str.indexOf('=>');
        if (arrowIdx === -1)
            return null;
        const body = str.slice(arrowIdx + 2).trim();
        if (body.includes('&&')) {
            const parts = body.split('&&').map((p) => p.trim());
            const expressions = [];
            for (const part of parts) {
                const be = this.parseBinary(part);
                if (!be)
                    return null;
                expressions.push(be);
            }
            const node = {
                type: 'LogicalExpression',
                operator: Nodes_1.LogicalOperator.And,
                expressions
            };
            return node;
        }
        return this.parseBinary(body);
    }
    /**
     * Parse a simple binary comparison like `a.price >= 10`.
     */
    parseBinary(expr) {
        const patterns = [
            { re: /\w+\.(\w+)\s*===?\s*(.+)/, op: Nodes_1.ComparisonOperator.Eq },
            { re: /\w+\.(\w+)\s*>=\s*(.+)/, op: Nodes_1.ComparisonOperator.Gte },
            { re: /\w+\.(\w+)\s*<=\s*(.+)/, op: Nodes_1.ComparisonOperator.Lte },
            { re: /\w+\.(\w+)\s*>\s*(.+)/, op: Nodes_1.ComparisonOperator.Gt },
            { re: /\w+\.(\w+)\s*<\s*(.+)/, op: Nodes_1.ComparisonOperator.Lt }
        ];
        for (const { re, op } of patterns) {
            const match = expr.match(re);
            if (match) {
                const idName = match[1];
                if (!/^[_A-Za-z][_\w]*$/.test(idName))
                    return null;
                const id = { type: 'Identifier', name: idName };
                const litRaw = match[2].trim();
                if (/^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*$/.test(litRaw)) {
                    return null;
                }
                const parsedValue = this.parseLiteral(litRaw);
                if (parsedValue === undefined && !/^(null)$/i.test(litRaw)) {
                    return null;
                }
                const lit = { type: 'Literal', value: parsedValue ?? null };
                return { type: 'BinaryExpression', left: id, operator: op, right: lit };
            }
        }
        return null;
    }
    /**
     * Parse a literal token into a JS value understood by the SQL visitor.
     */
    parseLiteral(raw) {
        if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
            return raw.slice(1, -1);
        }
        const num = Number(raw);
        if (!Number.isNaN(num))
            return num;
        if (raw === 'true')
            return true;
        if (raw === 'false')
            return false;
        if (raw.toLowerCase() === 'null')
            return null;
        return undefined;
    }
}
exports.PredicateParser = PredicateParser;
PredicateParser.MAX_LENGTH = 500;
PredicateParser.UNSUPPORTED_TOKENS = ['function', '=> {', 'return', '||', '??'];
//# sourceMappingURL=PredicateParser.js.map