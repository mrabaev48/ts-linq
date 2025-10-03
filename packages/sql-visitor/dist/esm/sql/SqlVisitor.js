import { BinaryVisitor } from '../visitors/BinaryVisitor';
import { LogicalVisitor } from '../visitors/LogicalVisitor';
export class SqlVisitor {
    constructor() {
        this.binary = new BinaryVisitor();
        this.logical = new LogicalVisitor();
    }
    toSql(node) {
        if (node.type === 'BinaryExpression')
            return this.binary.visit(node);
        if (node.type === 'LogicalExpression')
            return this.logical.visit(node, (n) => this.toSql(n));
        return { condition: '1=1', parameters: [] };
    }
}
//# sourceMappingURL=SqlVisitor.js.map