// Public contract of `@ts-linq/sql-visitor`: the `SqlVisitor` engine plus the ports, rewriters,
// emitters and translator/fragment types that dialects and `query` depend on. Sub-visitors and
// free helpers are implementation collaborators and live behind `@ts-linq/sql-visitor/internal`.
export { buildQuestionMarkRows, calcChunkSize, chunkArray } from './batch-emitter';
export { ComplexAccessRewriter } from './ComplexAccessRewriter';
export { emitTagComments } from './emit-tags';
export type { EfFunctionTranslator } from './functions/FunctionTranslator';
export { JsonAccessRewriter } from './JsonAccessRewriter';
export { ParameterState, ParameterStyle } from './ParameterStyle';
export { CallSyntaxEmitter, ExecSyntaxEmitter } from './sp-call-emitter';
export { SqlVisitor, type SqlVisitorOptions } from './SqlVisitor';
export type { ConditionFragment, SqlFragment } from './types';
export type { ColumnResolver, ConverterResolver, NodeVisitor, VisitContext } from './visitContext';
export type { JsonPathTranslator } from './visitors/JsonPathVisitor';
export type { JsonPathExpression } from '@ts-linq/ast';
/** @deprecated Use {@link JsonPathExpression} instead. */
export type { JsonPathNode } from '@ts-linq/ast';
