/** Логические операторы для составных булевых выражений. */
export var LogicalOperator;
(function (LogicalOperator) {
    LogicalOperator["And"] = "AND";
    LogicalOperator["Or"] = "OR";
})(LogicalOperator || (LogicalOperator = {}));
/** Операторы сравнения, поддерживаемые минимальным AST. */
export var ComparisonOperator;
(function (ComparisonOperator) {
    ComparisonOperator["Eq"] = "=";
    ComparisonOperator["Gt"] = ">";
    ComparisonOperator["Gte"] = ">=";
    ComparisonOperator["Lt"] = "<";
    ComparisonOperator["Lte"] = "<=";
})(ComparisonOperator || (ComparisonOperator = {}));
//# sourceMappingURL=Nodes.js.map