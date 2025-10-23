import { IncludePlanner } from '../../src/query/IncludePlanner';

describe('IncludePlanner', () => {
  class E {}

  test('does nothing when no includes', async () => {
    const loader = { populateRelationshipsMany: jest.fn(async () => {}) } as any;
    const planner = new IncludePlanner(loader, E);
    await planner.populateIncludes([new E()], []);
    expect(loader.populateRelationshipsMany).not.toHaveBeenCalled();
  });

  test('delegates to EntityLoader with strategy Eager when includes present', async () => {
    const loader = { populateRelationshipsMany: jest.fn(async () => {}) } as any;
    const planner = new IncludePlanner(loader, E);
    await planner.populateIncludes([new E(), new E()], ['orders']);
    expect(loader.populateRelationshipsMany).toHaveBeenCalledTimes(1);
    const args = loader.populateRelationshipsMany.mock.calls[0];
    expect(args[0]).toHaveLength(2);
    expect(args[1]).toBe(E);
    expect(args[2]).toMatchObject({ strategy: 'eager', includes: ['orders'], depth: 1 });
  });
});
