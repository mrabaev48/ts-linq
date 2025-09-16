import type { SqlLogger, QueryStartInfo, QueryEndInfo, RetryInfo, TransactionInfo, CacheInfo } from '../types';
/**
 * Composite logger that fan-outs all SqlLogger calls to a list of delegates.
 * Each delegate is called in order; errors are swallowed to avoid impacting
 * query execution flow.
 */
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