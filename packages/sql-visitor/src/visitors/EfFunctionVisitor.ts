import type { EfFunctionNode, LiteralNode, ParameterRefNode, PropertyNode } from '@ts-linq/ast';
import { AstSqlGenerationError } from '@ts-linq/ast';
import type { SqlParameter } from '@ts-linq/types';

import type { EfFunctionTranslator } from '../functions/FunctionTranslator';
import type { ParameterState } from '../ParameterStyle';
import type { ConditionFragment } from '../types';
import type { ColumnResolver, NodeVisitor, VisitContext } from '../visitContext';
import { renderPropertyName, resolveParameterRef } from './BinaryVisitor';

export class EfFunctionVisitor implements NodeVisitor<EfFunctionNode> {
  constructor(
    private readonly translator: EfFunctionTranslator,
    private readonly userFunctions: ReadonlyMap<string, string> = new Map()
  ) {}

  public visit(node: EfFunctionNode, ctx: VisitContext): ConditionFragment {
    const { inputParameters, resolver, state } = ctx;
    const { fn, args } = node;

    switch (fn) {
      case 'like': {
        const col = this.resolveCol(args[0], resolver);
        const { sql, parameters } = this.resolveParam(args[1], inputParameters, resolver, state);
        return { condition: this.translator.like(col, sql), parameters };
      }

      case 'iLike': {
        if (!this.translator.iLike) {
          throw new AstSqlGenerationError(
            'UNSUPPORTED_FUNCTION',
            'EF.functions.iLike() is only supported on PostgreSQL. ' +
              'The current dialect does not provide an iLike translator.',
            { nodeType: 'efFunction', fn }
          );
        }
        const col = this.resolveCol(args[0], resolver);
        const { sql, parameters } = this.resolveParam(args[1], inputParameters, resolver, state);
        return { condition: this.translator.iLike(col, sql), parameters };
      }

      case 'random':
        return { condition: this.translator.random(), parameters: [] };

      case 'dateDiffDay': {
        const col = this.resolveCol(args[0], resolver);
        const { sql, parameters } = this.resolveParam(args[1], inputParameters, resolver, state);
        return { condition: this.translator.dateDiffDay(col, sql), parameters };
      }

      case 'dateDiffMonth': {
        const col = this.resolveCol(args[0], resolver);
        const { sql, parameters } = this.resolveParam(args[1], inputParameters, resolver, state);
        return { condition: this.translator.dateDiffMonth(col, sql), parameters };
      }

      case 'greatest': {
        const { parts, parameters } = this.resolveVariadicArgs(
          args,
          inputParameters,
          resolver,
          state
        );
        return { condition: this.translator.greatest(...parts), parameters };
      }

      case 'least': {
        const { parts, parameters } = this.resolveVariadicArgs(
          args,
          inputParameters,
          resolver,
          state
        );
        return { condition: this.translator.least(...parts), parameters };
      }

      case 'stDev': {
        const col = this.resolveCol(args[0], resolver);
        return { condition: this.translator.stDev(col), parameters: [] };
      }

      case 'variance': {
        const col = this.resolveCol(args[0], resolver);
        return { condition: this.translator.variance(col), parameters: [] };
      }

      default: {
        // User-defined function registered via ModelBuilder.hasDbFunction()
        const sqlName = this.userFunctions.get(fn);
        if (sqlName === undefined) {
          throw new AstSqlGenerationError(
            'UNSUPPORTED_FUNCTION',
            `Unknown EF function: "${fn}". Register it via ModelBuilder.hasDbFunction().hasName("${fn}").`,
            { nodeType: 'efFunction', fn }
          );
        }
        const { parts, parameters } = this.resolveVariadicArgs(
          args,
          inputParameters,
          resolver,
          state
        );
        return { condition: `${sqlName}(${parts.join(', ')})`, parameters };
      }
    }
  }

  private resolveCol(
    arg: PropertyNode | LiteralNode | ParameterRefNode | undefined,
    resolver?: ColumnResolver
  ): string {
    if (arg === undefined) {
      throw new AstSqlGenerationError(
        'INVALID_FUNCTION_NODE',
        'EfFunctionNode is missing required column argument.',
        { nodeType: 'efFunction' }
      );
    }
    if (arg.type !== 'property') {
      throw new AstSqlGenerationError(
        'INVALID_FUNCTION_NODE',
        'EF function first argument must be an entity property.',
        { nodeType: 'efFunction' }
      );
    }
    return renderPropertyName(arg, resolver);
  }

  private resolveParam(
    arg: PropertyNode | LiteralNode | ParameterRefNode | undefined,
    inputParameters: readonly unknown[],
    resolver: ColumnResolver | undefined,
    state: ParameterState
  ): { sql: string; parameters: SqlParameter[] } {
    if (arg === undefined) {
      throw new AstSqlGenerationError(
        'INVALID_FUNCTION_NODE',
        'EfFunctionNode is missing required parameter argument.',
        { nodeType: 'efFunction' }
      );
    }
    return this.renderArg(arg, inputParameters, resolver, state);
  }

  private resolveVariadicArgs(
    args: readonly (PropertyNode | LiteralNode | ParameterRefNode)[],
    inputParameters: readonly unknown[],
    resolver: ColumnResolver | undefined,
    state: ParameterState
  ): { parts: string[]; parameters: SqlParameter[] } {
    const parts: string[] = [];
    const parameters: SqlParameter[] = [];

    for (const arg of args) {
      const { sql, parameters: argParams } = this.renderArg(arg, inputParameters, resolver, state);
      parts.push(sql);
      parameters.push(...argParams);
    }

    return { parts, parameters };
  }

  /**
   * Renders a single EF function argument to a SQL fragment.
   *
   * A property used in a value position is inlined as a resolved column reference
   * (no placeholder, no bound parameter); literals and parameter refs are emitted as
   * placeholders with their value bound. Shared by both the single-value
   * ({@link resolveParam}) and variadic ({@link resolveVariadicArgs}) paths.
   */
  private renderArg(
    arg: PropertyNode | LiteralNode | ParameterRefNode,
    inputParameters: readonly unknown[],
    resolver: ColumnResolver | undefined,
    state: ParameterState
  ): { sql: string; parameters: SqlParameter[] } {
    if (arg.type === 'property') {
      return { sql: renderPropertyName(arg, resolver), parameters: [] };
    }
    const placeholder = state.next();
    if (arg.type === 'literal') return { sql: placeholder, parameters: [arg.value] };
    return {
      sql: placeholder,
      parameters: [resolveParameterRef(arg, inputParameters) as SqlParameter]
    };
  }
}
