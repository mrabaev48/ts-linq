import { InClauseChunker } from '../../src/loading/support/InClauseChunker';

class Target {}

function makeProvider() {
  const crossQuery = jest.fn();
  const findWhereIn = jest.fn(async (_ctor: unknown, _col: string, vals: unknown[]) =>
    vals.map((v) => ({ id: v }))
  );
  return {
    findWhereIn,
    crossQuery,
    provider: {
      findWhereIn,
      loggerRef: { crossQuery },
      providerLabel: 'test'
    } as never
  };
}

describe('InClauseChunker', () => {
  const chunker = new InClauseChunker();

  it('issues a single query when size == chunkSize (no telemetry)', async () => {
    const { provider, findWhereIn, crossQuery } = makeProvider();

    const result = await chunker.query(provider, Target as never, 'id', [1, 2, 3], 3);

    expect(findWhereIn).toHaveBeenCalledTimes(1);
    expect(findWhereIn).toHaveBeenCalledWith(Target, 'id', [1, 2, 3]);
    expect(crossQuery).not.toHaveBeenCalled();
    expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it('splits into chunks and emits crossQuery telemetry when size > chunkSize', async () => {
    const { provider, findWhereIn, crossQuery } = makeProvider();

    const result = await chunker.query(provider, Target as never, 'id', [1, 2, 3, 4, 5], 2);

    expect(findWhereIn).toHaveBeenCalledTimes(3);
    expect(findWhereIn).toHaveBeenNthCalledWith(1, Target, 'id', [1, 2]);
    expect(findWhereIn).toHaveBeenNthCalledWith(2, Target, 'id', [3, 4]);
    expect(findWhereIn).toHaveBeenNthCalledWith(3, Target, 'id', [5]);
    expect(crossQuery).toHaveBeenCalledTimes(1);
    expect(crossQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        op: 'IN-chunk',
        chunks: 3,
        size: 5,
        column: 'id',
        provider: 'test'
      })
    );
    expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]);
  });

  it('handles an empty value list with a single query and no telemetry', async () => {
    const { provider, findWhereIn, crossQuery } = makeProvider();

    const result = await chunker.query(provider, Target as never, 'id', [], 1000);

    expect(findWhereIn).toHaveBeenCalledTimes(1);
    expect(findWhereIn).toHaveBeenCalledWith(Target, 'id', []);
    expect(crossQuery).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('never throws when crossQuery telemetry fails', async () => {
    const findWhereIn = jest.fn(async (_c: unknown, _col: string, vals: unknown[]) =>
      vals.map((v) => ({ id: v }))
    );
    const provider = {
      findWhereIn,
      loggerRef: {
        crossQuery: () => {
          throw new Error('telemetry down');
        }
      },
      providerLabel: 'test'
    } as never;

    await expect(chunker.query(provider, Target as never, 'id', [1, 2, 3], 2)).resolves.toEqual([
      { id: 1 },
      { id: 2 },
      { id: 3 }
    ]);
  });
});
