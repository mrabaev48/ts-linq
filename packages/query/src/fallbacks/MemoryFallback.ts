import type { QueryFallback, FallbackRequest } from '@ts-linq/types';

export interface MemoryFallbackOptions<T> {
  label?: string;
  dataSupplier: () => ReadonlyArray<T> | Promise<ReadonlyArray<T>>;
  refreshIntervalMs?: number;
}

export class MemoryFallback<T> implements QueryFallback<T> {
  public readonly label: string;
  private readonly dataSupplier: () => ReadonlyArray<T> | Promise<ReadonlyArray<T>>;
  private cachedData: T[] | null = null;
  private lastRefreshTime: number = 0;
  private readonly refreshIntervalMs: number;

  constructor(
    dataSupplierOrOptions: (() => ReadonlyArray<T> | Promise<ReadonlyArray<T>>) | MemoryFallbackOptions<T>
  ) {
    if (typeof dataSupplierOrOptions === 'function') {
      this.label = 'memory';
      this.dataSupplier = dataSupplierOrOptions;
      this.refreshIntervalMs = Infinity;
    } else {
      this.label = dataSupplierOrOptions.label ?? 'memory';
      this.dataSupplier = dataSupplierOrOptions.dataSupplier;
      this.refreshIntervalMs = dataSupplierOrOptions.refreshIntervalMs ?? Infinity;
    }
  }

  canHandle(_request: FallbackRequest<T>): boolean {
    return true;
  }

  async execute<TResult>(request: FallbackRequest<TResult>): Promise<TResult[]> {
    return this.fetch(request);
  }

  async fetch<TResult>(request: FallbackRequest<TResult>): Promise<TResult[]> {
    const data = await this.getData();
    let result: T[] = [...data];

    const query = request.query;
    if (query) {
      if (query.offset !== undefined && query.offset > 0) {
        result = result.slice(query.offset);
      }

      if (query.limit !== undefined && query.limit > 0) {
        result = result.slice(0, query.limit);
      }
    }

    return result as unknown as TResult[];
  }

  async fetchCount<TResult>(request: FallbackRequest<TResult>): Promise<number> {
    const data = await this.getData();
    return data.length;
  }

  private async getData(): Promise<T[]> {
    const now = Date.now();
    const needsRefresh = 
      this.cachedData === null || 
      (this.refreshIntervalMs !== Infinity && now - this.lastRefreshTime > this.refreshIntervalMs);

    if (needsRefresh) {
      const result = this.dataSupplier();
      const arr = result instanceof Promise ? await result : result;
      this.cachedData = [...arr];
      this.lastRefreshTime = now;
    }

    return this.cachedData!;
  }

  public clearCache(): void {
    this.cachedData = null;
    this.lastRefreshTime = 0;
  }
}
