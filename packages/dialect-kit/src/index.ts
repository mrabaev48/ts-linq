// Public contract of `@ts-linq/dialect-kit`: shared, stateless SQL clause emitters that every
// dialect composes into its `buildSelect`. Each is a pure function; the only dialect-specific
// concern (identifier quoting) is injected into `emitJoin`. This is the single source of truth for
// clause rendering — dialects must not re-implement these.
export { emitGroup } from './emitters/emitGroup';
export { emitJoin } from './emitters/emitJoin';
export { emitOrder } from './emitters/emitOrder';
export { emitWhere } from './emitters/emitWhere';
