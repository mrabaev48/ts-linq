import type { ExpressionNode } from '@ts-linq/ast';
import type { ConditionFragment } from '@ts-linq/ast';
import { AstSqlGenerationError } from '@ts-linq/ast';

import { ParameterState, ParameterStyle } from './ParameterStyle';
import { BinaryVisitor, type ColumnResolver } from './visitors/BinaryVisitor';
import { InVisitor } from './visitors/InVisitor';
import { LogicalVisitor } from './visitors/LogicalVisitor';
import { MethodVisitor } from './visitors/MethodVisitor';
import { NullVisitor } from './visitors/NullVisitor';
import { UnaryVisitor } from './visitors/UnaryVisitor';

/**
 * Converts a compiled ExpressionNode tree into a SQL WHERE fragment with parameters.
 *
 * Column name resolution: by default identifiers are emitted as-is (TypeScript property names).
 * Pass a `ColumnResolver` to map property names to their actual SQL column names — required
 * when the entity uses `@Column({ name: 'snake_case_name' })` decorators.
 *
 * Pass a `ParameterStyle` to control placeholder rendering:
 *   - `ParameterStyle.Question`   (default) — MySQL/SQLite style: ?
 *   - `ParameterStyle.Positional`            — PostgreSQL style: $1, $2, ...
 *   - `ParameterStyle.Named`                 — MSSQL style: @p1, @p2, ...
 */
export class SqlVisitor {
  private readonly binary = new BinaryVisitor();
  private readonly logical = new LogicalVisitor();
  private readonly unary = new UnaryVisitor();
  private readonly nullV = new NullVisitor();
  private readonly inV = new InVisitor();
  private readonly method = new MethodVisitor();

  constructor(private readonly parameterStyle: ParameterStyle = ParameterStyle.Question) {}

  public toSql(
    node: ExpressionNode,
    inputParameters: readonly unknown[] = [],
    resolver?: ColumnResolver
  ): ConditionFragment {
    const state = new ParameterState(this.parameterStyle);
    return this._visit(node, inputParameters, resolver, state);
  }

  private _visit(
    node: ExpressionNode,
    inputParameters: readonly unknown[],
    resolver: ColumnResolver | undefined,
    state: ParameterState
  ): ConditionFragment {
    const recurse = (n: ExpressionNode) => this._visit(n, inputParameters, resolver, state);

    switch (node.type) {
      case 'binary':
        return this.binary.visit(node, inputParameters, recurse, resolver, state);
      case 'logical':
        return this.logical.visit(node, recurse);
      case 'not':
        return this.unary.visit(node, recurse, resolver, state);
      case 'isNull':
        return this.nullV.visitIsNull(node, resolver);
      case 'isNotNull':
        return this.nullV.visitIsNotNull(node, resolver);
      case 'in':
        return this.inV.visit(node, inputParameters, resolver, state);
      case 'method':
        return this.method.visit(node, inputParameters, resolver, state);
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
