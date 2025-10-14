import type { QueryFallback, FallbackRequest } from '../../types';
export declare class MemoryFallback<T> implements QueryFallback<T> {
    readonly label: string;
    private readonly dataProvider;
    constructor(dataProvider: () => ReadonlyArray<T> | Promise<ReadonlyArray<T>>);
    fetch(_request: FallbackRequest<T>): Promise<ReadonlyArray<T> | null>;
}
//# sourceMappingURL=MemoryFallback.d.ts.map