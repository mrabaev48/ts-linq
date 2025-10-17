export interface DatabaseProvider {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    execute<T = any>(sql: string, params: any[]): Promise<T[]>;
    beginTransaction(): Promise<void>;
    commitTransaction(): Promise<void>;
    rollbackTransaction(): Promise<void>;
}
export interface MockExecutionResult {
    sql: string;
    params: any[];
    result: any;
}
export declare class MockDatabaseProvider implements DatabaseProvider {
    private executions;
    private mockResults;
    private connected;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    execute<T = any>(sql: string, params: any[]): Promise<T[]>;
    beginTransaction(): Promise<void>;
    commitTransaction(): Promise<void>;
    rollbackTransaction(): Promise<void>;
    mockResult(sql: string, result: any): void;
    mockResultPattern(pattern: RegExp, result: any): void;
    getExecutions(): MockExecutionResult[];
    getLastExecution(): MockExecutionResult | undefined;
    clearExecutions(): void;
    clearMocks(): void;
    reset(): void;
    isConnected(): boolean;
    expectSql(expectedSql: string): void;
    expectParams(expectedParams: any[]): void;
}
export declare function createMockProvider(): MockDatabaseProvider;
//# sourceMappingURL=MockProvider.d.ts.map