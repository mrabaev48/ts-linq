'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.SqlVisitor = void 0;
const Nodes_1 = require('./Nodes');
/**
 * Visitor that turns a supported AST into a SQL WHERE fragment with parameters.
 * Does not quote identifiers; relies on upstream mapping to column names.
 */
class SqlVisitor {
  /**
   * Convert an AST node to a SQL WHERE fragment and parameters.
   */
  toSql(node) {
    switch (node.type) {
      case 'BinaryExpression':
        return this.visitBinary(node);
      case 'LogicalExpression':
        return this.visitLogical(node);
      default:
        return { condition: '1=1', parameters: [] };
    }
  }
  /**
   * Handle a binary comparison node.
   */
  visitBinary(node) {
    const column = node.left.name;
    const value = node.right.value;
    const op = node.operator;
    return { condition: `${column} ${op} ?`, parameters: [value] };
  }
  /**
   * Handle a logical AND/OR node by concatenating child results.
   */
  visitLogical(node) {
    const parts = [];
    const params = [];
    for (const expr of node.expressions) {
      const result = this.toSql(expr);
      parts.push(result.condition);
      params.push(...result.parameters);
    }
    const joiner = node.operator === Nodes_1.LogicalOperator.And ? ' AND ' : ' OR ';
    return { condition: parts.join(joiner), parameters: params };
  }
}
exports.SqlVisitor = SqlVisitor;
//# sourceMappingURL=SqlVisitor.js.map
