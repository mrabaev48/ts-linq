import { ComparisonOperator, LogicalOperator } from '../ast/Nodes';
/**
 * Лёгкий парсер, который преобразует поддерживаемые предикаты-функции
 * (например, a => a.price >= 10 && a.stock > 0) в минимальный AST,
 * потребляемый посетителем SQL. Для неподдерживаемых/сложных выражений
 * возвращает null для fallback-фильтрации на клиенте.
 */
export class PredicateParser {
    /**
     * Попытаться распарсить предикат в минимальный AST.
     * Вернуть null при обнаружении неподдерживаемых конструкций.
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
                operator: LogicalOperator.And,
                expressions
            };
            return node;
        }
        return this.parseBinary(body);
    }
    /**
     * Распарсить простое бинарное сравнение вида `a.price >= 10`.
     */
    parseBinary(expr) {
        const patterns = [
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
     * Распарсить литерал в JS-значение, которое понимает SQL-визитор.
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
PredicateParser.MAX_LENGTH = 500;
PredicateParser.UNSUPPORTED_TOKENS = ['function', '=> {', 'return', '||', '??'];
//# sourceMappingURL=PredicateParser.js.map