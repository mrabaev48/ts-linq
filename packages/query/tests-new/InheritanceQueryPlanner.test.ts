/**
 * Unit tests for {@link InheritanceQueryPlanner} — the ofType TPH/TPT/TPC strategy extracted from
 * `Queryable` (refactor query/task-1). The end-to-end facade behavior is covered by
 * tests/of-type.test.ts; here we exercise the planner in isolation with a fake quoteIdentifier.
 */
import { MetadataStorage } from '@ts-linq/metadata';
import { InheritanceStrategy } from '@ts-linq/types';

import { InheritanceQueryPlanner } from '../src/InheritanceQueryPlanner';
import { QueryModel } from '../src/QueryModel';

// --- TPH hierarchy ---
class IqpNote {
  id!: number;
}
class IqpEmailNote extends IqpNote {}

// --- TPT hierarchy ---
class IqpPayment {
  id!: number;
}
class IqpCardPayment extends IqpPayment {}

// --- TPC hierarchy ---
class IqpShape {
  id!: number;
}
class IqpCircle extends IqpShape {}

// --- standalone (no hierarchy) ---
class IqpStandalone {}

const quote = (id: string): string => `"${id}"`;

beforeAll(() => {
  // TPH
  MetadataStorage.addEntity(IqpNote, 'iqp_notes');
  MetadataStorage.addEntity(IqpEmailNote, 'iqp_notes');
  MetadataStorage.setHierarchyMetadata(IqpNote, {
    strategy: InheritanceStrategy.Tph,
    rootEntity: IqpNote,
    discriminator: {
      columnName: 'kind',
      columnType: 'TEXT',
      entries: [{ ctor: IqpEmailNote, value: 'email' }],
      isComplete: true
    },
    subtypes: [IqpEmailNote]
  });
  MetadataStorage.setHierarchyRoot(IqpEmailNote, IqpNote);

  // TPT
  MetadataStorage.addEntity(IqpPayment, 'iqp_payments');
  MetadataStorage.addPrimaryKey(IqpPayment, 'id');
  MetadataStorage.addEntity(IqpCardPayment, 'iqp_card_payments');
  MetadataStorage.setHierarchyMetadata(IqpPayment, {
    strategy: InheritanceStrategy.Tpt,
    rootEntity: IqpPayment,
    subtypes: [IqpCardPayment]
  });
  MetadataStorage.setHierarchyRoot(IqpCardPayment, IqpPayment);

  // TPC
  MetadataStorage.addEntity(IqpShape, 'iqp_shapes');
  MetadataStorage.addEntity(IqpCircle, 'iqp_circles');
  MetadataStorage.setHierarchyMetadata(IqpShape, {
    strategy: InheritanceStrategy.Tpc,
    rootEntity: IqpShape,
    subtypes: [IqpCircle]
  });
  MetadataStorage.setHierarchyRoot(IqpCircle, IqpShape);

  // standalone
  MetadataStorage.addEntity(IqpStandalone, 'iqp_standalones');
});

describe('InheritanceQueryPlanner', () => {
  const planner = new InheritanceQueryPlanner();

  it('TPH: adds a discriminator WHERE quoted via the dialect', () => {
    const model = new QueryModel();
    planner.plan(IqpEmailNote, model, quote);
    expect(model.where).toEqual([{ condition: '"kind" = ?', parameters: ['email'] }]);
  });

  it('TPT: adds an INNER join to the subtype table on the shared PK', () => {
    const model = new QueryModel();
    planner.plan(IqpCardPayment, model, quote);
    expect(model.joins).toEqual([
      {
        type: 'INNER',
        table: 'iqp_card_payments',
        onColumns: [
          {
            left: { table: 'iqp_payments', column: 'id' },
            right: { table: 'iqp_card_payments', column: 'id' }
          }
        ]
      }
    ]);
  });

  it('TPC: repoints the FROM to the concrete leaf table', () => {
    const model = new QueryModel();
    planner.plan(IqpCircle, model, quote);
    expect(model.from).toBe('iqp_circles');
  });

  it('no-ops for an entity that is not part of a hierarchy', () => {
    const model = new QueryModel();
    planner.plan(IqpStandalone, model, quote);
    expect(model.where).toBeUndefined();
    expect(model.joins).toBeUndefined();
    expect(model.from).toBeUndefined();
  });
});
