"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComparisonOperator = exports.LogicalOperator = void 0;
/** Logical operators used in compound boolean expressions. */
var LogicalOperator;
(function (LogicalOperator) {
    LogicalOperator["And"] = "AND";
    LogicalOperator["Or"] = "OR";
})(LogicalOperator || (exports.LogicalOperator = LogicalOperator = {}));
/** Comparison operators supported by the minimal AST. */
var ComparisonOperator;
(function (ComparisonOperator) {
    ComparisonOperator["Eq"] = "=";
    ComparisonOperator["Gt"] = ">";
    ComparisonOperator["Gte"] = ">=";
    ComparisonOperator["Lt"] = "<";
    ComparisonOperator["Lte"] = "<=";
})(ComparisonOperator || (exports.ComparisonOperator = ComparisonOperator = {}));
//# sourceMappingURL=Nodes.js.map