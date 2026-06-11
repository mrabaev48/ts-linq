/**
 * Unit tests for {@link QueryRunner} — the terminal-operation orchestrator extracted from
 * `Queryable` (refactor query/task-1).
 */
import { QueryTrackingBehavior } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import { QuerySplittingBehavior } from '@ts-linq/types';

import type { QueryExecutor } from '../src/QueryExecutor';
import { QueryModel } from '../src/QueryModel';
import { QueryRunner, type RunSpec } from '../src/QueryRunner';
import { TrackingCoordinator } from '../src/TrackingCoordinator';

class RunnerUser {
  id!: number;
}

beforeAll(() => {
  MetadataStorage.addEntity(RunnerUser, 'runner_users');
  MetadataStorage.addColumn(RunnerUser, { propertyName: 'id', columnName: 'id', type: 'INTEGER' });
  MetadataStorage.addPrimaryKey(RunnerUser, 'id');
});

function makeExecutor(rows: RunnerUser[], calls: unknown[][] = []): QueryExecutor<RunnerUser> {
  return {
    executeAndMaterialize: (...args: unknown[]) => {
      calls.push(args);
      return Promise.resolve(rows);
    }
  } as unknown as QueryExecutor<RunnerUser>;
}

function spec(overrides: Partial<RunSpec<RunnerUser>>): RunSpec<RunnerUser> {
  return {
    model: new QueryModel(),
    executor: makeExecutor([]),
    entityClass: RunnerUser,
    includes: [],
    cte: undefined,
    splitting: QuerySplittingBehavior.SingleQuery,
    filteredIncludes: undefined,
    abortSignal: undefined,
    trackingMode: QueryTrackingBehavior.NoTracking,
    attacher: undefined,
    ...overrides
  };
}

describe('QueryRunner.materialize', () => {
  const runner = new QueryRunner(new TrackingCoordinator());

  it('throws if the abort signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(runner.materialize(spec({ abortSignal: controller.signal }))).rejects.toThrow(
      'Operation aborted'
    );
  });

  it('returns raw entities and forwards model/includes/cte/splitting/filtered to the executor', async () => {
    const calls: unknown[][] = [];
    const model = new QueryModel();
    const executor = makeExecutor([{ id: 1 }, { id: 1 }], calls);

    const result = await runner.materialize(
      spec({
        model,
        executor,
        includes: ['posts'],
        splitting: QuerySplittingBehavior.SplitQuery,
        // identity-resolution mode, but materialize() must NOT dedup
        trackingMode: QueryTrackingBehavior.NoTrackingWithIdentityResolution
      })
    );

    expect(result).toEqual([{ id: 1 }, { id: 1 }]);
    expect(calls[0][0]).toBe(model);
    expect(calls[0][1]).toEqual(['posts']);
    expect(calls[0][3]).toBe(QuerySplittingBehavior.SplitQuery);
  });
});

describe('QueryRunner.toList', () => {
  const runner = new QueryRunner(new TrackingCoordinator());

  it('applies identity-resolution (dedup by PK) on top of materialize', async () => {
    const first = { id: 1 };
    const result = await runner.toList(
      spec({
        executor: makeExecutor([first, { id: 1 }, { id: 2 }]),
        trackingMode: QueryTrackingBehavior.NoTrackingWithIdentityResolution
      })
    );

    expect(result).toEqual([first, first, { id: 2 }]);
    expect(result[1]).toBe(first);
  });

  it('attaches under TrackAll', async () => {
    const attached: object[] = [];
    const result = await runner.toList(
      spec({
        executor: makeExecutor([{ id: 1 }, { id: 2 }]),
        trackingMode: QueryTrackingBehavior.TrackAll,
        attacher: { attach: (e: object) => attached.push(e) } as never
      })
    );

    expect(result).toHaveLength(2);
    expect(attached).toHaveLength(2);
  });
});
