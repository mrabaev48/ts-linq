import type { ColumnDef } from '../src/DiffTypes';

/**
 * Type-level guard (migrations/task-7): the computed/default/comment attributes are
 * first-class optional members of `ColumnDef`, so the diff handlers read them directly
 * instead of via structural casts. A regression that drops or retypes one of these fields
 * fails compilation here (ts-jest compiles the file before the runtime assertion runs).
 */
describe('ColumnDef — computed/default/comment fields are typed', () => {
  test('all flagged fields exist with their expected types', () => {
    // Forces presence of every field the former casts reached. If any were removed,
    // this Required<Pick<…>> alias would no longer be satisfiable.
    const fullyTyped = {
      isComputed: true,
      computedExpression: 'a + b',
      computedStorage: 'STORED',
      defaultExpression: 'now()',
      comment: 'audit column'
    } satisfies Required<
      Pick<
        ColumnDef,
        'isComputed' | 'computedExpression' | 'computedStorage' | 'defaultExpression' | 'comment'
      >
    >;

    // Direct, cast-free property access must type-check.
    const flag: boolean | undefined = fullyTyped.isComputed;
    const expr: string | undefined = fullyTyped.computedExpression;
    const storage: 'VIRTUAL' | 'STORED' | 'PERSISTED' | undefined = fullyTyped.computedStorage;
    const def: string | undefined = fullyTyped.defaultExpression;
    const comment: string | undefined = fullyTyped.comment;

    expect([flag, expr, storage, def, comment]).toEqual([
      true,
      'a + b',
      'STORED',
      'now()',
      'audit column'
    ]);
  });

  test('computedStorage is constrained to the storage union', () => {
    // @ts-expect-error — an arbitrary string is not assignable to the storage union.
    const bad: ColumnDef['computedStorage'] = 'SOMETHING_ELSE';
    expect(bad).toBe('SOMETHING_ELSE');
  });
});
