import type { SqlLogger, QueryStartInfo, QueryEndInfo, RetryInfo, TransactionInfo, CacheInfo } from '@ts-linq/core';
export declare class CompositeSqlLogger implements SqlLogger {
    private readonly delegates;
    constructor(...delegates: Array<SqlLogger | undefined | null>);
    queryStart(info: QueryStartInfo): void;
    queryEnd(info: QueryEndInfo): void;
    retry(info: RetryInfo): void;
    transactionStart(info: TransactionInfo): void;
    transactionEnd(info: TransactionInfo): void;
    cache(info: CacheInfo): void;
}
//# sourceMappingURL=CompositeSqlLogger.d.ts.map