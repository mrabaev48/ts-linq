export type ComparisonOperator = '==' | '===' | '!=' | '!==' | '>' | '<' | '>=' | '<=';
export type LogicalOperator = '&&' | '||';

export type ExpressionNodeKind =
  | 'binary'
  | 'logical'
  | 'not'
  | 'literal'
  | 'property'
  | 'parameterRef'
  | 'method'
  | 'in'
  | 'isNull'
  | 'isNotNull'
  | 'efFunction'
  | 'unsupported';

export interface BinaryNode {
  readonly type: 'binary';
  readonly operator: ComparisonOperator;
  readonly left: ExpressionNode;
  readonly right: ExpressionNode;
}

export interface LogicalNode {
  readonly type: 'logical';
  readonly operator: LogicalOperator;
  readonly left: ExpressionNode;
  readonly right: ExpressionNode;
}

export interface NotNode {
  readonly type: 'not';
  readonly operand: ExpressionNode;
}

export interface LiteralNode {
  readonly type: 'literal';
  readonly value: string | number | boolean | null;
}

export interface PropertyNode {
  readonly type: 'property';
  readonly name?: string;
  readonly path?: readonly string[];
  readonly optional?: boolean;
}

export interface ParameterRefNode {
  readonly type: 'parameterRef';
  readonly index: number;
}

export interface MethodNode {
  readonly type: 'method';
  readonly method: string;
  readonly object: PropertyNode;
  readonly args: readonly ExpressionNode[];
}

export interface InNode {
  readonly type: 'in';
  readonly property: PropertyNode;
  readonly values?: readonly LiteralNode[];
  readonly valuesRef?: number;
}

export interface IsNullNode {
  readonly type: 'isNull';
  readonly property: PropertyNode;
}

export interface IsNotNullNode {
  readonly type: 'isNotNull';
  readonly property: PropertyNode;
}

export interface EfFunctionNode {
  readonly type: 'efFunction';
  readonly fn: string;
  readonly args: readonly ExpressionNode[];
}

export interface UnsupportedNode {
  readonly type: 'unsupported';
  readonly syntaxKind: number;
  readonly description: string;
}

export type ExpressionNode =
  | BinaryNode
  | LogicalNode
  | NotNode
  | LiteralNode
  | PropertyNode
  | ParameterRefNode
  | MethodNode
  | InNode
  | IsNullNode
  | IsNotNullNode
  | EfFunctionNode
  | UnsupportedNode;
