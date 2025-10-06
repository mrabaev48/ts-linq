import { BinaryVisitor } from './visitors/BinaryVisitor';
import { LogicalVisitor } from './visitors/LogicalVisitor';
/**
 * Visitor that turns a supported AST into a SQL WHERE fragment with parameters.
 * Does not quote identifiers; relies on upstream mapping to column names.
 */
export class SqlVisitor {
  constructor() {
    this.binary = new BinaryVisitor();
    this.logical = new LogicalVisitor();
  }
  /**
   * Convert an AST node to a SQL WHERE fragment and parameters.
   */
  toSql(node) {
    if (node.type === 'BinaryExpression') return this.binary.visit(node);
    if (node.type === 'LogicalExpression') return this.logical.visit(node, this.toSql.bind(this));
    return { condition: '1=1', parameters: [] };
  }
}
//# sourceMappingURL=SqlVisitor.js.map
