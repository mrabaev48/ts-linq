export class BinaryVisitor {
    visit(node) {
        const column = node.left.name;
        const value = node.right.value;
        const op = node.operator;
        // Quote column name for case-sensitive databases (PostgreSQL)
        return { condition: `"${column}" ${op} ?`, parameters: [value] };
    }
}
//# sourceMappingURL=BinaryVisitor.js.map