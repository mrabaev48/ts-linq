import type {
  EfFunctionNode,
  ExpressionNode,
  JsonPathExpression,
  UnsupportedNode
} from '@ts-linq/ast';
import { AstSqlGenerationError } from '@ts-linq/ast';
import type { HierarchyIdTranslator, SpatialTranslator } from '@ts-linq/types';

import type { ComplexAccessRewriter } from './ComplexAccessRewriter';
import type { EfFunctionTranslator } from './functions/FunctionTranslator';
import type { JsonAccessRewriter } from './JsonAccessRewriter';
import { ParameterState, ParameterStyle } from './ParameterStyle';
import type { ConditionFragment } from './types';
import type { ColumnResolver, ConverterResolver, NodeVisitor, VisitContext } from './visitContext';
import { BinaryVisitor } from './visitors/BinaryVisitor';
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
 * Registered for `unsupported` nodes (sentinels emitted by the transformer for expressions
 * it could not compile). Always present so the failure surfaces a stable, descriptive error.
 */
const UNSUPPORTED_VISITOR: NodeVisitor<UnsupportedNode> = {
  visit(node) {
    throw new AstSqlGenerationError(
      'UNSUPPORTED_NODE_TYPE',
      `Unsupported expression in WHERE clause: ${node.description}`,
      { nodeType: node.type, syntaxKind: node.syntaxKind }
    );
  }
};

/**
 * Registered for `efFunction` nodes when no `efFunctionTranslator` was configured.
 * Centralises the former inline "throw if not configured" guard.
 */
const EF_FUNCTION_NOT_CONFIGURED: NodeVisitor<EfFunctionNode> = {
  visit(node) {
    throw new AstSqlGenerationError(
      'UNSUPPORTED_FUNCTION',
      `EF.functions.${node.fn}() requires an efFunctionTranslator. Pass one via SqlVisitor options.`,
      { nodeType: 'efFunction', fn: node.fn }
    );
  }
};

/**
 * Registered for `jsonPath` nodes when no `jsonPathTranslator` was configured.
 * Centralises the former inline "throw if not configured" guard.
 */
const JSON_PATH_NOT_CONFIGURED: NodeVisitor<JsonPathExpression> = {
  visit(node) {
    throw new AstSqlGenerationError(
      'UNSUPPORTED_NODE_TYPE',
      `JSON path expression requires a jsonPathTranslator. Pass one via SqlVisitor options.`,
      { nodeType: 'jsonPath', column: node.column, path: node.path }
    );
  }
};

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

  /**
   * Node-type → visitor dispatch table. Replaces the former hand-written switch and mirrors
   * the transformer package's `DISPATCH_MAP`. Adding a node type means adding a visitor and
   * one registry entry — no edits to {@link _visit}.
   */
  private readonly registry = new Map<ExpressionNode['type'], NodeVisitor>();

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

    // Always-available node visitors.
    this.register('binary', this.binary);
    this.register('logical', this.logical);
    this.register('not', this.unary);
    this.register('isNull', this.nullV);
    this.register('isNotNull', this.nullV);
    this.register('in', this.inV);
    this.register('method', this.method);
    this.register('unsupported', UNSUPPORTED_VISITOR);

    // Optional visitors register their real implementation when a translator is configured,
    // otherwise a stub that throws the same "not configured" error as before.
    this.register('efFunction', this.efFunction ?? EF_FUNCTION_NOT_CONFIGURED);
    this.register('jsonPath', this.jsonPath ?? JSON_PATH_NOT_CONFIGURED);
  }

  /**
   * Type-safe registry insertion: the literal `type` must match the visitor's node type `N`.
   * The stored value is widened to `NodeVisitor` for the heterogeneous map (visitor `visit`
   * methods are bivariant), mirroring the transformer's `as VisitorFn` registration.
   */
  private register<N extends ExpressionNode>(type: N['type'], visitor: NodeVisitor<N>): void {
    this.registry.set(type, visitor as NodeVisitor);
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
    const ctx: VisitContext = {
      inputParameters,
      resolver,
      converterResolver: this.converterResolver,
      state,
      recurse: (n) => this._visit(n, ctx)
    };
    return this._visit(rewritten, ctx);
  }

  private _visit(node: ExpressionNode, ctx: VisitContext): ConditionFragment {
    const visitor = this.registry.get(node.type);
    if (visitor === undefined) {
      throw new AstSqlGenerationError(
        'UNSUPPORTED_NODE_TYPE',
        `Unsupported root node type: '${node.type}'.`,
        { nodeType: node.type }
      );
    }
    return visitor.visit(node, ctx);
  }
}
