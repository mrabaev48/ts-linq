import type { BinaryExpressionNode } from '../ast/Nodes';
import type { SqlParameter } from '@ts-linq/types';
export declare class BinaryVisitor {
    visit(node: BinaryExpressionNode): {
        condition: string;
        parameters: SqlParameter[];
    };
}
//# sourceMappingURL=BinaryVisitor.d.ts.map