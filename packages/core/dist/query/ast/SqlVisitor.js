"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqlVisitor = void 0;
const BinaryVisitor_1 = require("../visitors/BinaryVisitor");
const LogicalVisitor_1 = require("../visitors/LogicalVisitor");
/**
 * Visitor that turns a supported AST into a SQL WHERE fragment with parameters.
 * Does not quote identifiers; relies on upstream mapping to column names.
 */
class SqlVisitor {
    constructor() {
        this.binary = new BinaryVisitor_1.BinaryVisitor();
        this.logical = new LogicalVisitor_1.LogicalVisitor();
    }
    /**
     * Convert an AST node to a SQL WHERE fragment and parameters.
     */
    toSql(node) {
        if (node.type === 'BinaryExpression')
            return this.binary.visit(node);
        if (node.type === 'LogicalExpression')
            return this.logical.visit(node, (n) => this.toSql(n));
        return { condition: '1=1', parameters: [] };
    }
}
exports.SqlVisitor = SqlVisitor;
//# sourceMappingURL=SqlVisitor.js.map