import type { EfFunctionNode, LiteralNode, ParameterRefNode, PropertyNode } from '@ts-linq/ast';
import { AstSqlGenerationError } from '@ts-linq/ast';
import type { SqlParameter } from '@ts-linq/types';

import type { EfFunctionTranslator } from '../functions/FunctionTranslator';
import { ParameterState, ParameterStyle } from '../ParameterStyle';
import type { ConditionFragment } from '../types';
import { type ColumnResolver, renderPropertyName, resolveParameterRef } from './BinaryVisitor';

export class EfFunctionVisitor {
  constructor(
    private readonly translator: EfFunctionTranslator,
    private readonly userFunctions: ReadonlyMap<string, string> = new Map()
  ) {}

  public visit(
    node: EfFunctionNode,
    inputParameters: readonly unknown[],
    resolver?: ColumnResolver,
    state: ParameterState = new ParameterState(ParameterStyle.Question)
  ): ConditionFragment {
    const { fn, args } = node;

    switch (fn) {
      case 'like': {
        const col = this.resolveCol(args[0], resolver);
        const [param, value] = this.resolveParam(args[1], inputParameters, state);
        return { condition: this.translator.like(col, param), parameters: [value] };
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
        const [param, value] = this.resolveParam(args[1], inputParameters, state);
        return { condition: this.translator.iLike(col, param), parameters: [value] };
      }

      case 'random':
        return { condition: this.translator.random(), parameters: [] };

      case 'dateDiffDay': {
        const col = this.resolveCol(args[0], resolver);
        const [param, value] = this.resolveParam(args[1], inputParameters, state);
        return { condition: this.translator.dateDiffDay(col, param), parameters: [value] };
      }

      case 'dateDiffMonth': {
        const col = this.resolveCol(args[0], resolver);
        const [param, value] = this.resolveParam(args[1], inputParameters, state);
        return { condition: this.translator.dateDiffMonth(col, param), parameters: [value] };
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
    state: ParameterState
  ): [placeholder: string, value: SqlParameter] {
    if (arg === undefined) {
      throw new AstSqlGenerationError(
        'INVALID_FUNCTION_NODE',
        'EfFunctionNode is missing required parameter argument.',
        { nodeType: 'efFunction' }
      );
    }
    const placeholder = state.next();
    if (arg.type === 'literal') return [placeholder, arg.value];
    if (arg.type === 'parameterRef')
      return [placeholder, resolveParameterRef(arg, inputParameters) as SqlParameter];
    // Property node used as a value (rare but allowed)
    return [placeholder, renderPropertyName(arg, undefined)];
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
      if (arg.type === 'property') {
        parts.push(renderPropertyName(arg, resolver));
      } else if (arg.type === 'literal') {
        const placeholder = state.next();
        parts.push(placeholder);
        parameters.push(arg.value);
      } else {
        const placeholder = state.next();
        parts.push(placeholder);
        parameters.push(resolveParameterRef(arg, inputParameters) as SqlParameter);
      }
    }

    return { parts, parameters };
  }
}
