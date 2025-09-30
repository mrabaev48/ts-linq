import { StepPlanner } from '../../src/migrations/services/StepPlanner';

describe('StepPlanner', () => {
  test('returns SQL steps (up) for simple empty diff (no ops)', () => {
    const planner = new StepPlanner();
    const expected = { tables: [] } as any;
    const actual = { tables: [] } as any;
    const steps = planner.plan(expected, actual, 'sqlite');
    expect(Array.isArray(steps)).toBe(true);
  });
});
