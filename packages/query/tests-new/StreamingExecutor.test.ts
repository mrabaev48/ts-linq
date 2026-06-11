/**
 * Unit tests for {@link StreamingExecutor} — the streaming collaborator extracted from `Queryable`
 * (refactor query/task-1).
 */
import type { DatabaseProvider } from '@ts-linq/core';
import { QueryTrackingBehavior } from '@ts-linq/core';
import type { EntityAttacher } from '@ts-linq/types';

import type { QueryBuilder } from '../src/QueryBuilder';
import { QueryModel } from '../src/QueryModel';
import type { RowMaterializer } from '../src/RowMaterializer';
import { StreamingExecutor } from '../src/StreamingExecutor';

class Row {
  id!: number;
}

interface StreamArgs {
  sql: string;
  params: readonly unknown[];
  offset: number;
  maxRows: number | undefined;
}

function makeProvider(rows: unknown[], captured: StreamArgs[]): DatabaseProvider {
  return {
    providerLabel: 'test',
    streamRows: async function* (
      sql: string,
      params: readonly unknown[],
      offset: number,
      maxRows: number | undefined
    ) {
      captured.push({ sql, params, offset, maxRows });
      for (const row of rows) yield row;
    }
  } as unknown as DatabaseProvider;
}

function makeSqlBuilder(): QueryBuilder {
  return {
    generateFromModel: () => ({ query: 'SELECT * FROM rows', parameters: [1, 2] })
  } as unknown as QueryBuilder;
}

function makeMaterializer(): RowMaterializer<Row> {
  return {
    mapRowToEntity: (row: { id: number }) => ({ id: row.id }) as Row
  } as unknown as RowMaterializer<Row>;
}

async function drain<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iterable) out.push(item);
  return out;
}

describe('StreamingExecutor.stream', () => {
  it('consumes offset/limit as the window, clears them from the model, and maps rows', async () => {
    const captured: StreamArgs[] = [];
    const provider = makeProvider([{ id: 1 }, { id: 2 }], captured);
    const executor = new StreamingExecutor<Row>(
      Row,
      provider,
      makeSqlBuilder(),
      makeMaterializer()
    );

    const model = new QueryModel();
    model.offset = 10;
    model.limit = 50;

    const result = await drain(executor.stream(model, QueryTrackingBehavior.NoTracking, undefined));

    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    expect(captured[0]).toMatchObject({ offset: 10, maxRows: 50 });
    // Window is cleared from the model before SQL generation.
    expect(model.offset).toBeUndefined();
    expect(model.limit).toBeUndefined();
  });

  it('attaches entities under TrackAll with an attacher', async () => {
    const attached: object[] = [];
    const attacher = {
      attach: (entity: object) => attached.push(entity)
    } as unknown as EntityAttacher;
    const provider = makeProvider([{ id: 1 }, { id: 2 }], []);
    const executor = new StreamingExecutor<Row>(
      Row,
      provider,
      makeSqlBuilder(),
      makeMaterializer()
    );

    await drain(executor.stream(new QueryModel(), QueryTrackingBehavior.TrackAll, attacher));

    expect(attached).toHaveLength(2);
  });

  it('does not attach under NoTracking', async () => {
    const attached: object[] = [];
    const attacher = {
      attach: (entity: object) => attached.push(entity)
    } as unknown as EntityAttacher;
    const provider = makeProvider([{ id: 1 }], []);
    const executor = new StreamingExecutor<Row>(
      Row,
      provider,
      makeSqlBuilder(),
      makeMaterializer()
    );

    await drain(executor.stream(new QueryModel(), QueryTrackingBehavior.NoTracking, attacher));

    expect(attached).toHaveLength(0);
  });
});

describe('StreamingExecutor.collectDictionary', () => {
  const executor = new StreamingExecutor<Row>(
    Row,
    makeProvider([], []),
    makeSqlBuilder(),
    makeMaterializer()
  );

  async function* iter(rows: Row[]): AsyncIterable<Row> {
    for (const r of rows) yield r;
  }

  it('keys by keySelector, defaulting the value to the entity', async () => {
    const map = await executor.collectDictionary(iter([{ id: 1 }, { id: 2 }]), (r) => r.id);
    expect(map.get(1)).toEqual({ id: 1 });
    expect(map.get(2)).toEqual({ id: 2 });
  });

  it('projects values with elementSelector', async () => {
    const map = await executor.collectDictionary(
      iter([{ id: 7 }]),
      (r) => r.id,
      (r) => `v${r.id}`
    );
    expect(map.get(7)).toBe('v7');
  });

  it('throws on duplicate keys', async () => {
    await expect(
      executor.collectDictionary(iter([{ id: 1 }, { id: 1 }]), (r) => r.id)
    ).rejects.toThrow('An item with the same key has already been added. Key: 1');
  });
});
