import type { BinaryExpressionNode } from '@ts-linq/ast';
import type { SqlParameter } from '../../types';
export declare class BinaryVisitor {
    visit(node: BinaryExpressionNode): {
        condition: string;
        parameters: SqlParameter[];
    };
}
//# sourceMappingURL=BinaryVisitor.d.ts.map