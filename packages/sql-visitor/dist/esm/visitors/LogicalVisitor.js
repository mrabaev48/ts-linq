import { LogicalOperator } from '@ts-linq/ast';
export class LogicalVisitor {
  visit(node, visit) {
    const parts = [];
    const params = [];
    for (const expr of node.expressions) {
      const result = visit(expr);
      parts.push(result.condition);
      params.push(...result.parameters);
    }
    const joiner = node.operator === LogicalOperator.And ? ' AND ' : ' OR ';
    return { condition: parts.join(joiner), parameters: params };
  }
}
//# sourceMappingURL=LogicalVisitor.js.map
