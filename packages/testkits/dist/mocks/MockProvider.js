export class MockDatabaseProvider {
    constructor() {
        this.executions = [];
        this.mockResults = new Map();
        this.connected = false;
    }
    async connect() {
        this.connected = true;
    }
    async disconnect() {
        this.connected = false;
    }
    async execute(sql, params) {
        // Try exact match first
        let result = this.mockResults.get(sql);
        // If no exact match, try regex patterns
        if (!result) {
            for (const [key, value] of this.mockResults.entries()) {
                if (key.startsWith('__regex__')) {
                    const pattern = new RegExp(key.replace('__regex__', ''));
                    if (pattern.test(sql)) {
                        result = value;
                        break;
                    }
                }
            }
        }
        const finalResult = result || [];
        this.executions.push({ sql, params, result: finalResult });
        return finalResult;
    }
    async beginTransaction() {
        await this.execute('BEGIN TRANSACTION', []);
    }
    async commitTransaction() {
        await this.execute('COMMIT', []);
    }
    async rollbackTransaction() {
        await this.execute('ROLLBACK', []);
    }
    mockResult(sql, result) {
        this.mockResults.set(sql, result);
    }
    mockResultPattern(pattern, result) {
        const key = `__regex__${pattern.source}`;
        this.mockResults.set(key, result);
    }
    getExecutions() {
        return [...this.executions];
    }
    getLastExecution() {
        return this.executions[this.executions.length - 1];
    }
    clearExecutions() {
        this.executions = [];
    }
    clearMocks() {
        this.mockResults.clear();
    }
    reset() {
        this.clearExecutions();
        this.clearMocks();
        this.connected = false;
    }
    isConnected() {
        return this.connected;
    }
    expectSql(expectedSql) {
        const last = this.getLastExecution();
        if (!last) {
            throw new Error('No SQL executed');
        }
        if (last.sql !== expectedSql) {
            throw new Error(`Expected SQL: ${expectedSql}\nGot: ${last.sql}`);
        }
    }
    expectParams(expectedParams) {
        const last = this.getLastExecution();
        if (!last) {
            throw new Error('No SQL executed');
        }
        if (JSON.stringify(last.params) !== JSON.stringify(expectedParams)) {
            throw new Error(`Expected params: ${JSON.stringify(expectedParams)}\nGot: ${JSON.stringify(last.params)}`);
        }
    }
}
export function createMockProvider() {
    return new MockDatabaseProvider();
}
//# sourceMappingURL=MockProvider.js.map