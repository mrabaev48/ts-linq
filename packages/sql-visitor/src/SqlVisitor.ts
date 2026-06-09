import type { ExpressionNode } from '@ts-linq/ast';
import { AstSqlGenerationError } from '@ts-linq/ast';
import type { HierarchyIdTranslator, SpatialTranslator } from '@ts-linq/types';

import type { ComplexAccessRewriter } from './ComplexAccessRewriter';
import type { EfFunctionTranslator } from './functions/FunctionTranslator';
import type { JsonAccessRewriter } from './JsonAccessRewriter';
import { ParameterState, ParameterStyle } from './ParameterStyle';
import type { ConditionFragment } from './types';
import {
  BinaryVisitor,
  type ColumnResolver,
  type ConverterResolver
} from './visitors/BinaryVisitor';
import { EfFunctionVisitor } from './visitors/EfFunctionVisitor';
import { HierarchyMethodVisitor } from './visitors/HierarchyMethodVisitor';
import { InVisitor } from './visitors/InVisitor';
import type { JsonPathTranslator } from './visitors/JsonPathVisitor';
import { JsonPathVisitor } from './visitors/JsonPathVisitor';
import { LogicalVisitor } from './visitors/LogicalVisitor';
import { MethodVisitor } from './visitors/MethodVisitor';
import { NullVisitor } from './visitors/NullVisitor';
import { SpatialMethodVisitor } from './visitors/SpatialMethodVisitor';
import { UnaryVisitor } from './visitors/UnaryVisitor';

export { ComplexAccessRewriter } from './ComplexAccessRewriter';
export { JsonAccessRewriter } from './JsonAccessRewriter';
export type { JsonPathTranslator } from './visitors/JsonPathVisitor';

export interface SqlVisitorOptions {
  spatialTranslator?: SpatialTranslator;
  hierarchyTranslator?: HierarchyIdTranslator;
  /** Resolves property names to their ValueConverter for predicate lifting. */
  converterResolver?: ConverterResolver;
  /** Enables EF.functions.xxx() translation for the target dialect. */
  efFunctionTranslator?: EfFunctionTranslator;
  /** User-defined functions registered via ModelBuilder.hasDbFunction(). Maps fn key → SQL name. */
  userFunctions?: ReadonlyMap<string, string>;
  /** Translates JSON path expressions for the target dialect. Required when querying JSON columns. */
  jsonPathTranslator?: JsonPathTranslator;
  /** Rewrites multi-segment property paths into JSON path expressions before SQL generation. */
  jsonAccessRewriter?: JsonAccessRewriter;
  /** Rewrites multi-segment property paths for complex type properties into flat column names (P1-17). */
  complexAccessRewriter?: ComplexAccessRewriter;
}

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
 *
 * Pass `options.spatialTranslator` to enable spatial method translation
 * (distance, intersects, within, buffer, area, length, contains).
 *
 * Pass `options.converterResolver` to enable converter lifting in WHERE predicates —
 * literal values compared against a converted property are automatically transformed.
 */
export class SqlVisitor {
  private readonly binary = new BinaryVisitor();
  private readonly logical = new LogicalVisitor();
  private readonly unary = new UnaryVisitor();
  private readonly nullV = new NullVisitor();
  private readonly inV = new InVisitor();
  private readonly method: MethodVisitor;
  private readonly efFunction?: EfFunctionVisitor;
  private readonly converterResolver?: ConverterResolver;
  private readonly jsonPath?: JsonPathVisitor;
  private readonly jsonRewriter?: JsonAccessRewriter;
  private readonly complexRewriter?: ComplexAccessRewriter;

  constructor(
    private readonly parameterStyle: ParameterStyle = ParameterStyle.Question,
    options?: SqlVisitorOptions
  ) {
    const spatialVisitor = options?.spatialTranslator
      ? new SpatialMethodVisitor(options.spatialTranslator)
      : undefined;
    const hierarchyVisitor = options?.hierarchyTranslator
      ? new HierarchyMethodVisitor(options.hierarchyTranslator)
      : undefined;
    this.method = new MethodVisitor(spatialVisitor, hierarchyVisitor);
    this.efFunction = options?.efFunctionTranslator
      ? new EfFunctionVisitor(options.efFunctionTranslator, options.userFunctions)
      : undefined;
    this.converterResolver = options?.converterResolver;
    this.jsonPath = options?.jsonPathTranslator
      ? new JsonPathVisitor(options.jsonPathTranslator)
      : undefined;
    this.jsonRewriter = options?.jsonAccessRewriter;
    this.complexRewriter = options?.complexAccessRewriter;
  }

  public toSql(
    node: ExpressionNode,
    inputParameters: readonly unknown[] = [],
    resolver?: ColumnResolver
  ): ConditionFragment {
    const state = new ParameterState(this.parameterStyle);
    // Complex type paths must be flattened before JSON rewriting, as JSON rewriting
    // operates on the already-flattened column names.
    const afterComplex = this.complexRewriter ? this.complexRewriter.rewrite(node) : node;
    const rewritten = this.jsonRewriter ? this.jsonRewriter.rewrite(afterComplex) : afterComplex;
    return this._visit(rewritten, inputParameters, resolver, state);
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
        return this.binary.visit(
          node,
          inputParameters,
          recurse,
          resolver,
          state,
          this.converterResolver
        );
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
      case 'efFunction':
        if (!this.efFunction) {
          throw new AstSqlGenerationError(
            'UNSUPPORTED_FUNCTION',
            `EF.functions.${node.fn}() requires an efFunctionTranslator. Pass one via SqlVisitor options.`,
            { nodeType: 'efFunction', fn: node.fn }
          );
        }
        return this.efFunction.visit(node, inputParameters, resolver, state);
      case 'jsonPath':
        if (!this.jsonPath) {
          throw new AstSqlGenerationError(
            'UNSUPPORTED_NODE_TYPE',
            `JSON path expression requires a jsonPathTranslator. Pass one via SqlVisitor options.`,
            { nodeType: 'jsonPath', column: node.column, path: node.path }
          );
        }
        return this.jsonPath.visit(node, state);
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
