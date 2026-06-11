import type { QueryModel } from './QueryModel';

/** The five LINQ set operators that compile to SQL UNION / UNION ALL / EXCEPT / INTERSECT. */
export type SetOperationKind = 'union' | 'unionAll' | 'except' | 'intersect' | 'concat';

/** A structured entry pushed onto `QueryModel.unions`. */
export interface SetOperationEntry {
  all: boolean;
  setOp?: 'EXCEPT' | 'INTERSECT';
  other: QueryModel;
  entity: new () => unknown;
}

/**
 * Builds the structured set-operation entry for `union`/`unionAll`/`except`/`intersect`/`concat`.
 *
 * Stateless — shared by reference across all clones of a `Queryable` chain. The operand's model is
 * deep-cloned so the resulting entry never aliases the other queryable's mutable state.
 */
export class SetOperationBuilder {
  build(
    kind: SetOperationKind,
    otherModel: QueryModel,
    otherEntity: new () => unknown
  ): SetOperationEntry {
    const other = otherModel.clone();
    switch (kind) {
      case 'union':
        return { all: false, other, entity: otherEntity };
      case 'unionAll':
      case 'concat':
        return { all: true, other, entity: otherEntity };
      case 'except':
        return { all: false, setOp: 'EXCEPT', other, entity: otherEntity };
      case 'intersect':
        return { all: false, setOp: 'INTERSECT', other, entity: otherEntity };
    }
  }
}
