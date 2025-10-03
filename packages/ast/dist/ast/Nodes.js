"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComparisonOperator = exports.LogicalOperator = void 0;
/** Логические операторы для составных булевых выражений. */
var LogicalOperator;
(function (LogicalOperator) {
    LogicalOperator["And"] = "AND";
    LogicalOperator["Or"] = "OR";
})(LogicalOperator || (exports.LogicalOperator = LogicalOperator = {}));
/** Операторы сравнения, поддерживаемые минимальным AST. */
var ComparisonOperator;
(function (ComparisonOperator) {
    ComparisonOperator["Eq"] = "=";
    ComparisonOperator["Gt"] = ">";
    ComparisonOperator["Gte"] = ">=";
    ComparisonOperator["Lt"] = "<";
    ComparisonOperator["Lte"] = "<=";
})(ComparisonOperator || (exports.ComparisonOperator = ComparisonOperator = {}));
//# sourceMappingURL=Nodes.js.map