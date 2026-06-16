/**
 * Unit tests for the extracted SaveChangesPipeline (refactor orm/task-1).
 *
 * Exercises step ordering and short-circuit behaviour in isolation with mocked
 * collaborators — complements the end-to-end characterization suite.
 */
import 'reflect-metadata';

import { describe, expect, it, jest } from '@jest/globals';
import { InterceptionResult } from '@ts-linq/core';

import { SaveChangesPipeline } from '../src/context/save-pipeline/SaveChangesPipeline';
import type { SavePipelineDeps } from '../src/context/save-pipeline/SavePipeline.types';

type Change = { entity: object; entityClass: unknown; state: string };

function makeDeps(opts: {
  changes: Change[];
  interceptors?: object[];
  isActive?: boolean;
  executeReturn?: number;
}): {
  deps: SavePipelineDeps;
  spies: {
    executeChanges: jest.Mock;
    applySkipNav: jest.Mock;
    acceptAllChanges: jest.Mock;
    begin: jest.Mock;
    commit: jest.Mock;
    rollback: jest.Mock;
    invalidate: jest.Mock;
  };
} {
  const executeChanges = jest.fn(async () => opts.executeReturn ?? 0);
  const applySkipNav = jest.fn(async () => 0);
  const acceptAllChanges = jest.fn();
  const begin = jest.fn(async () => undefined);
  const commit = jest.fn(async () => undefined);
  const rollback = jest.fn(async () => undefined);
  const invalidate = jest.fn();

  const deps = {
    provider: { beginTransaction: begin, commitTransaction: commit, rollbackTransaction: rollback },
    changeTracker: {
      autoDetectChangesEnabled: false,
      detectChanges: jest.fn(),
      applyCascades: jest.fn(),
      getChanges: jest.fn(() => opts.changes),
      collectSkipNavigationChanges: jest.fn(() => []),
      acceptAllChanges
    },
    valueGen: { prefillHiLoIds: jest.fn(async () => undefined), prefillDefaults: jest.fn() },
    validationService: { validate: jest.fn() },
    interceptorRegistry: { forEachSaveChanges: jest.fn(() => opts.interceptors ?? []) },
    changeExecutor: { executeChanges, applySkipNavigationChanges: applySkipNav },
    cacheCoordinator: { invalidateAfterMutation: invalidate },
    transactionScope: { isActive: opts.isActive ?? false }
  } as unknown as SavePipelineDeps;

  return {
    deps,
    spies: { executeChanges, applySkipNav, acceptAllChanges, begin, commit, rollback, invalidate }
  };
}

describe('SaveChangesPipeline', () => {
  it('empty change set short-circuits: returns 0, no transaction, no DML', async () => {
    const { deps, spies } = makeDeps({ changes: [] });
    const result = await new SaveChangesPipeline(deps).run();

    expect(result).toBe(0);
    expect(spies.begin).not.toHaveBeenCalled();
    expect(spies.executeChanges).not.toHaveBeenCalled();
    expect(spies.acceptAllChanges).not.toHaveBeenCalled();
  });

  it('savingChanges suppression short-circuits before DML and returns the suppressed value', async () => {
    const interceptor = {
      savingChanges: () => InterceptionResult.SuppressWithResult<number>(42)
    };
    const { deps, spies } = makeDeps({
      changes: [{ entity: {}, entityClass: class {}, state: 'added' }],
      interceptors: [interceptor]
    });

    const result = await new SaveChangesPipeline(deps).run();

    expect(result).toBe(42);
    expect(spies.executeChanges).not.toHaveBeenCalled();
    expect(spies.begin).not.toHaveBeenCalled();
  });

  it('happy path: opens own transaction, executes DML, commits, invalidates, accepts', async () => {
    const { deps, spies } = makeDeps({
      changes: [{ entity: {}, entityClass: class {}, state: 'added' }],
      executeReturn: 3
    });

    const result = await new SaveChangesPipeline(deps).run();

    expect(result).toBe(3);
    expect(spies.begin).toHaveBeenCalledTimes(1);
    expect(spies.executeChanges).toHaveBeenCalledTimes(1);
    expect(spies.commit).toHaveBeenCalledTimes(1);
    expect(spies.invalidate).toHaveBeenCalledTimes(1);
    expect(spies.acceptAllChanges).toHaveBeenCalledTimes(1);
    expect(spies.rollback).not.toHaveBeenCalled();
  });

  it('inside a caller-managed transaction: does not open or commit its own', async () => {
    const { deps, spies } = makeDeps({
      changes: [{ entity: {}, entityClass: class {}, state: 'added' }],
      isActive: true,
      executeReturn: 1
    });

    await new SaveChangesPipeline(deps).run();

    expect(spies.begin).not.toHaveBeenCalled();
    expect(spies.commit).not.toHaveBeenCalled();
    expect(spies.executeChanges).toHaveBeenCalledTimes(1);
    expect(spies.acceptAllChanges).toHaveBeenCalledTimes(1);
  });

  it('on DML failure: rolls back the own transaction and rethrows', async () => {
    const { deps, spies } = makeDeps({
      changes: [{ entity: {}, entityClass: class {}, state: 'added' }]
    });
    (spies.executeChanges as jest.Mock).mockImplementationOnce(async () => {
      throw new Error('dml failed');
    });

    await expect(new SaveChangesPipeline(deps).run()).rejects.toThrow('dml failed');
    expect(spies.rollback).toHaveBeenCalledTimes(1);
    expect(spies.commit).not.toHaveBeenCalled();
    expect(spies.acceptAllChanges).not.toHaveBeenCalled();
  });
});
