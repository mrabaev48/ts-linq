import { BatchPlan } from '../../src/batch/BatchPlan';

describe('BatchPlan.planChunks', () => {
  const plan = new BatchPlan();

  test('returns empty array for empty input', () => {
    expect(plan.planChunks([], 100)).toEqual([]);
  });

  test('single item yields single chunk', () => {
    expect(plan.planChunks([1], 10)).toEqual([[1]]);
  });

  test('exact multiple splits evenly', () => {
    const res = plan.planChunks([1, 2, 3, 4], 2);
    expect(res).toEqual([
      [1, 2],
      [3, 4]
    ]);
  });

  test('with remainder creates smaller last chunk', () => {
    const res = plan.planChunks([1, 2, 3, 4, 5], 2);
    expect(res).toEqual([[1, 2], [3, 4], [5]]);
  });
});
