/**
 * @internal — unstable implementation surface of `@ts-linq/sql-visitor`.
 *
 * These sub-visitors and free helpers are collaborators of {@link SqlVisitor}, not part of the
 * stable public contract. They are exposed only via the `@ts-linq/sql-visitor/internal` subpath
 * so that downstream packages which still reach into them keep compiling. They may change or be
 * removed without a major version bump — prefer `SqlVisitor` for all SQL generation.
 */
export { BinaryVisitor, renderPropertyName, resolveParameterRef } from './visitors/BinaryVisitor';
export { EfFunctionVisitor } from './visitors/EfFunctionVisitor';
export { FragmentJoinPlanner } from './visitors/FragmentJoinPlanner';
export { HierarchyMethodVisitor, isHierarchyMethod } from './visitors/HierarchyMethodVisitor';
export { InVisitor } from './visitors/InVisitor';
export { JsonPathVisitor } from './visitors/JsonPathVisitor';
export { LogicalVisitor } from './visitors/LogicalVisitor';
export { MethodVisitor } from './visitors/MethodVisitor';
export { NullVisitor } from './visitors/NullVisitor';
export { isSpatialMethod, SpatialMethodVisitor } from './visitors/SpatialMethodVisitor';
export { UnaryVisitor } from './visitors/UnaryVisitor';
