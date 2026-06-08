import type { SqlParameter } from '@ts-linq/types';

import type { JsonPathExpression } from './JsonPathExpression';

/**
 * A single property access on the predicate parameter, e.g. `u.age` or `u.profile.city`.
 * Single-segment paths use `name`; multi-segment paths use `path`.
 */
export interface PropertyNode {
  type: 'property';
  /** Single-segment: `u.age` → `name: "age"` */
  name?: string;
  /** Multi-segment: `u.profile.city` → `path: ["profile", "city"]` */
  path?: string[];
  /** True when any `?.` appeared in the source chain. */
  optional?: boolean;
}

/** A literal value embedded directly in the AST. */
export interface LiteralNode {
  type: 'literal';
  value: SqlParameter;
}

/**
 * Reference to a runtime value captured at compile time.
 * The SQL generator resolves it against `inputParameters[index]`.
 */
export interface ParameterRefNode {
  type: 'parameterRef';
  index: number;
}

/** A binary comparison: `left op right`. */
export interface BinaryNode {
  type: 'binary';
  operator: '==' | '===' | '!=' | '!==' | '>' | '<' | '>=' | '<=';
  left: ExpressionNode;
  right: ExpressionNode;
}

/** A logical combination of two sub-expressions. Supports both AND and OR. */
export interface LogicalNode {
  type: 'logical';
  operator: '&&' | '||';
  left: ExpressionNode;
  right: ExpressionNode;
}

/** Negation of an inner expression (`!expr`). */
export interface NotNode {
  type: 'not';
  operand: ExpressionNode;
}

/** `u.field === null` — renders as `col IS NULL`. */
export interface IsNullNode {
  type: 'isNull';
  property: PropertyNode;
}

/** `u.field !== null` — renders as `col IS NOT NULL`. */
export interface IsNotNullNode {
  type: 'isNotNull';
  property: PropertyNode;
}

/**
 * IN expression from `[...].includes(u.field)` or `arr.includes(u.field)`.
 * - `values` is populated for inline array literals.
 * - `valuesRef` (ParameterRef index) is populated for external array variables.
 */
export interface InNode {
  type: 'in';
  property: PropertyNode;
  values?: LiteralNode[];
  valuesRef?: number;
}

/**
 * String method call: `u.name.includes(arg)`, `u.name.startsWith(arg)`, `u.name.endsWith(arg)`.
 * Rendered as `col LIKE ?` with the appropriate wildcard pattern.
 *
 * Spatial methods (`distance`, `intersects`, `within`, `buffer`, `area`, `length`, `contains`)
 * are also part of this node type. Translation is dialect-specific via `SpatialTranslator`
 * registered on `SqlVisitor`.
 */
export type SpatialMethod =
  | 'distance'
  | 'intersects'
  | 'within'
  | 'buffer'
  | 'area'
  | 'length'
  | 'contains';

export type HierarchyMethod = 'isDescendantOf' | 'getLevel' | 'getAncestor';

export type StringMethod = 'includes' | 'startsWith' | 'endsWith';

export interface MethodNode {
  type: 'method';
  method: StringMethod | SpatialMethod | HierarchyMethod;
  object: PropertyNode;
  args: (LiteralNode | ParameterRefNode)[];
}

/**
 * Sentinel emitted by the transformer when it encounters an unsupported expression.
 * The transformer also emits a compiler Error diagnostic pointing at the source node.
 * The runtime throws `AstSqlGenerationError` if this node reaches SQL generation.
 */
/**
 * A built-in or user-defined DB function call via `EF.functions.xxx(...)`.
 * The `fn` field is a canonical EfFunction name or a user-supplied SQL name
 * registered via `ModelBuilder.hasDbFunction()`.
 */
export type EfFunction =
  | 'like'
  | 'iLike'
  | 'random'
  | 'dateDiffDay'
  | 'dateDiffMonth'
  | 'greatest'
  | 'least'
  | 'stDev'
  | 'variance';

export interface EfFunctionNode {
  type: 'efFunction';
  fn: EfFunction | string;
  args: (PropertyNode | LiteralNode | ParameterRefNode)[];
}

/**
 * Sentinel emitted by the transformer when it encounters an unsupported expression.
 * The transformer also emits a compiler Error diagnostic pointing at the source node.
 * The runtime throws `AstSqlGenerationError` if this node reaches SQL generation.
 */
export interface UnsupportedNode {
  type: 'unsupported';
  syntaxKind: number;
  description: string;
}

export type ExpressionNode =
  | PropertyNode
  | LiteralNode
  | ParameterRefNode
  | BinaryNode
  | LogicalNode
  | NotNode
  | IsNullNode
  | IsNotNullNode
  | InNode
  | MethodNode
  | EfFunctionNode
  | UnsupportedNode
  | JsonPathExpression;

/**
 * @deprecated Use {@link JsonPathExpression} from '@ts-linq/ast' instead.
 * Kept as a structural alias for backward compatibility; will be removed in a future major.
 */
export type JsonPathNode = JsonPathExpression;
