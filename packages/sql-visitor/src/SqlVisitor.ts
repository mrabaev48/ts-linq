import { BinaryVisitor, type ColumnResolver } from './visitors/BinaryVisitor';
import { LogicalVisitor } from './visitors/LogicalVisitor';
import { UnaryVisitor } from './visitors/UnaryVisitor';
import { NullVisitor } from './visitors/NullVisitor';
import { InVisitor } from './visitors/InVisitor';
import { MethodVisitor } from './visitors/MethodVisitor';
import { AstSqlGenerationError } from '@ts-linq/ast';
import type { ExpressionNode } from '@ts-linq/ast';
import type { ConditionFragment } from '@ts-linq/ast';

/**
 * Converts a compiled ExpressionNode tree into a SQL WHERE fragment with parameters.
 *
 * Column name resolution: by default identifiers are emitted as-is (TypeScript property names).
 * Pass a `ColumnResolver` to map property names to their actual SQL column names — required
 * when the entity uses `@Column({ name: 'snake_case_name' })` decorators.
 */
export class SqlVisitor {
  private readonly binary = new BinaryVisitor();
  private readonly logical = new LogicalVisitor();
  private readonly unary = new UnaryVisitor();
  private readonly null = new NullVisitor();
  private readonly in = new InVisitor();
  private readonly method = new MethodVisitor();

  public toSql(
    node: ExpressionNode,
    inputParameters: readonly unknown[] = [],
    resolver?: ColumnResolver
  ): ConditionFragment {
    const recurse = (n: ExpressionNode) => this.toSql(n, inputParameters, resolver);

    switch (node.type) {
      case 'binary':
        return this.binary.visit(node, inputParameters, recurse, resolver);
      case 'logical':
        return this.logical.visit(node, recurse);
      case 'not':
        return this.unary.visit(node, recurse, resolver);
      case 'isNull':
        return this.null.visitIsNull(node, resolver);
      case 'isNotNull':
        return this.null.visitIsNotNull(node, resolver);
      case 'in':
        return this.in.visit(node, inputParameters, resolver);
      case 'method':
        return this.method.visit(node, inputParameters, resolver);
      case 'unsupported':
        throw new AstSqlGenerationError(
          'UNSUPPORTED_NODE_TYPE',
          `Unsupported expression in WHERE clause: ${node.description}`,
          { nodeType: node.type, syntaxKind: node.syntaxKind }
        );
      default:
        throw new AstSqlGenerationError(
          'UNSUPPORTED_NODE_TYPE',
          `Unsupported root node type: '${(node as ExpressionNode).type}'.`,
          { nodeType: (node as ExpressionNode).type }
        );
    }
  }
}
