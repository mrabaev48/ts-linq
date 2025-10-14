import type { DatabaseProvider, FallbackPolicy } from '@ts-linq/core';
export declare function createProviderFromEnv(): DatabaseProvider;
/**
 * Read Graceful Degradation fallback policy from environment variables.
 * Consumers can pass the returned policy into DbContext PerformanceOptions.
 */
export declare function readFallbackPolicyFromEnv(): FallbackPolicy | undefined;
//# sourceMappingURL=provider-factory.d.ts.map