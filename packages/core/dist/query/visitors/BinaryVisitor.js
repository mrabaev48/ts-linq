"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BinaryVisitor = void 0;
class BinaryVisitor {
    visit(node) {
        const column = node.left.name;
        const value = node.right.value;
        const op = node.operator;
        return { condition: `${column} ${op} ?`, parameters: [value] };
    }
}
exports.BinaryVisitor = BinaryVisitor;
//# sourceMappingURL=BinaryVisitor.js.map