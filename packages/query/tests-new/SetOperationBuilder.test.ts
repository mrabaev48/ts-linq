/**
 * Unit tests for {@link SetOperationBuilder} — the set-operation clause builder extracted from
 * `Queryable` (refactor query/task-1).
 */
import { QueryModel } from '../src/QueryModel';
import { SetOperationBuilder } from '../src/SetOperationBuilder';

class Other {
  id!: number;
}

describe('SetOperationBuilder', () => {
  const builder = new SetOperationBuilder();

  function operand(): QueryModel {
    const m = new QueryModel();
    m.from = 'others';
    return m;
  }

  it('union → UNION (all=false, no setOp)', () => {
    const entry = builder.build('union', operand(), Other);
    expect(entry).toMatchObject({ all: false, entity: Other });
    expect(entry.setOp).toBeUndefined();
  });

  it('unionAll → UNION ALL (all=true, no setOp)', () => {
    const entry = builder.build('unionAll', operand(), Other);
    expect(entry).toMatchObject({ all: true, entity: Other });
    expect(entry.setOp).toBeUndefined();
  });

  it('concat → UNION ALL (all=true, no setOp)', () => {
    const entry = builder.build('concat', operand(), Other);
    expect(entry).toMatchObject({ all: true, entity: Other });
    expect(entry.setOp).toBeUndefined();
  });

  it('except → EXCEPT (all=false, setOp=EXCEPT)', () => {
    const entry = builder.build('except', operand(), Other);
    expect(entry).toMatchObject({ all: false, setOp: 'EXCEPT', entity: Other });
  });

  it('intersect → INTERSECT (all=false, setOp=INTERSECT)', () => {
    const entry = builder.build('intersect', operand(), Other);
    expect(entry).toMatchObject({ all: false, setOp: 'INTERSECT', entity: Other });
  });

  it('deep-clones the operand model so the entry never aliases it', () => {
    const model = operand();
    const entry = builder.build('union', model, Other);
    expect(entry.other).not.toBe(model);
    expect(entry.other.from).toBe('others');
  });
});
