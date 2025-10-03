import type { ExpressionNode } from '../ast/Nodes';
/**
 * Лёгкий парсер, который преобразует поддерживаемые предикаты-функции
 * (например, a => a.price >= 10 && a.stock > 0) в минимальный AST,
 * потребляемый посетителем SQL. Для неподдерживаемых/сложных выражений
 * возвращает null для fallback-фильтрации на клиенте.
 */
export declare class PredicateParser<T> {
    private static readonly MAX_LENGTH;
    private static readonly UNSUPPORTED_TOKENS;
    /**
     * Попытаться распарсить предикат в минимальный AST.
     * Вернуть null при обнаружении неподдерживаемых конструкций.
     */
    parse(predicate: (entity: T) => boolean): ExpressionNode | null;
    /**
     * Распарсить простое бинарное сравнение вида `a.price >= 10`.
     */
    private parseBinary;
    /**
     * Распарсить литерал в JS-значение, которое понимает SQL-визитор.
     */
    private parseLiteral;
}
//# sourceMappingURL=PredicateParser.d.ts.map