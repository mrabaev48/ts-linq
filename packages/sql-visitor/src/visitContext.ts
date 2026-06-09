import type { ExpressionNode, PropertyNode } from '@ts-linq/ast';
import type { ValueConverterLike } from '@ts-linq/types';

import type { ParameterState } from './ParameterStyle';
import type { ConditionFragment } from './types';

/**
 * Maps a PropertyNode to its SQL column name.
 * If no resolver is supplied, the TypeScript property name is used as-is.
 */
export type ColumnResolver = (property: PropertyNode) => string;

/**
 * Maps a property name to its ValueConverter (if any).
 * Used for converter lifting in WHERE predicates.
 */
export type ConverterResolver = (propertyName: string) => ValueConverterLike | undefined;

/**
 * Cohesive context threaded through every node visitor during SQL generation.
 *
 * Replaces the divergent positional parameters the sub-visitors used to accept
 * (`inputParameters`, `recurse`, `resolver`, `state`, `converterResolver`). A single
 * `ParameterState` instance is owned by the context so parameter numbering stays
 * consistent across the whole rendered statement — visitors must never create their own.
 */
export interface VisitContext {
  /** Captured runtime values; ParameterRef index = array position. */
  readonly inputParameters: readonly unknown[];
  /** Maps property nodes to SQL column names; identity (property name) when absent. */
  readonly resolver?: ColumnResolver;
  /** Enables converter lifting of literals compared against converted properties. */
  readonly converterResolver?: ConverterResolver;
  /** Owns the parameter placeholder counter for the whole statement. */
  readonly state: ParameterState;
  /** Recursive entry point for sub-expressions; threads the same context. */
  recurse(node: ExpressionNode): ConditionFragment;
}

/**
 * Uniform contract implemented by every node visitor. A visitor consumes a single
 * AST node of its narrowed type `N` plus the shared {@link VisitContext} and produces
 * a SQL `ConditionFragment`. The `SqlVisitor` registry dispatches on `ExpressionNode['type']`.
 */
export interface NodeVisitor<N extends ExpressionNode = ExpressionNode> {
  visit(node: N, ctx: VisitContext): ConditionFragment;
}
