import type { QueryFallback, FallbackRequest } from '../../types';

export class MemoryFallback<T> implements QueryFallback<T> {
  public readonly label: string = 'memory';
  private readonly dataProvider: () => ReadonlyArray<T> | Promise<ReadonlyArray<T>>;

  constructor(dataProvider: () => ReadonlyArray<T> | Promise<ReadonlyArray<T>>) {
    this.dataProvider = dataProvider;
  }

  public async fetch(_request: FallbackRequest<T>): Promise<ReadonlyArray<T> | null> {
    const data = await this.dataProvider();
    return data ?? [];
  }
}
