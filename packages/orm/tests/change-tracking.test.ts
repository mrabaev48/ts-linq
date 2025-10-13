import { ChangeTracker } from '../src/change-tracking/ChangeTracker';

enum EntityState {
  Added = 'added',
  Modified = 'modified',
  Deleted = 'deleted',
  Unchanged = 'unchanged'
}

describe('ChangeTracker (orm)', () => {
  let changeTracker: ChangeTracker;
  interface TestEntityShape {
    id: number;
    name: string;
  }
  let testEntity: TestEntityShape;

  beforeEach(() => {
    changeTracker = new ChangeTracker();
    testEntity = { id: 1, name: 'Test' };
  });

  it('add tracks Added', () => {
    changeTracker.add(testEntity, Object);
    expect(changeTracker.getEntityState(testEntity)).toBe(EntityState.Added);
  });
});
