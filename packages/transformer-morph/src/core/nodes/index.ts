export { makeArray, makeObject, makeUnsupported, num, prop, str, syntaxKindName } from './builders';
export type {
  BinaryNode,
  ComparisonOperator,
  ExpressionNode,
  ExpressionNodeKind,
  InNode,
  IsNotNullNode,
  IsNullNode,
  LiteralNode,
  LogicalNode,
  LogicalOperator,
  MethodNode,
  NotNode,
  ParameterRefNode,
  PropertyNode,
  UnsupportedNode
} from './ExpressionNode';
export {
  buildPropertyNode,
  collectPropertyChain,
  MAX_CHAIN_DEPTH,
  type PropertyChain
} from './PropertyChain';
