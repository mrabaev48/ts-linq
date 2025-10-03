"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogicalVisitor = void 0;
const ast_1 = require("@ts-linq/ast");
class LogicalVisitor {
    visit(node, visit) {
        const parts = [];
        const params = [];
        for (const expr of node.expressions) {
            const result = visit(expr);
            parts.push(result.condition);
            params.push(...result.parameters);
        }
        const joiner = node.operator === ast_1.LogicalOperator.And ? ' AND ' : ' OR ';
        return { condition: parts.join(joiner), parameters: params };
    }
}
exports.LogicalVisitor = LogicalVisitor;
//# sourceMappingURL=LogicalVisitor.js.map