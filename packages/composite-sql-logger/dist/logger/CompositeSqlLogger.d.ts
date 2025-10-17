import type { SqlLogger, QueryStartInfo, QueryEndInfo, RetryInfo, TransactionInfo, CacheInfo, CircuitEventInfo, ConnectionHealthInfo, FallbackInfo, QueryAnalysisInfo } from '@ts-linq/core';
export declare class CompositeSqlLogger implements SqlLogger {
    private readonly delegates;
    constructor(...delegates: Array<SqlLogger | undefined | null>);
    queryStart(info: QueryStartInfo): void;
    queryEnd(info: QueryEndInfo): void;
    retry(info: RetryInfo): void;
    transactionStart(info: TransactionInfo): void;
    transactionEnd(info: TransactionInfo): void;
    cache(info: CacheInfo): void;
    connectionHealth(info: ConnectionHealthInfo): void;
    circuit(info: CircuitEventInfo): void;
    fallback(info: FallbackInfo): void;
    hedgedWin(info: {
        provider?: string;
        operation: string;
        fallback: string;
    }): void;
    analysis(info: QueryAnalysisInfo): void;
}
//# sourceMappingURL=CompositeSqlLogger.d.ts.map