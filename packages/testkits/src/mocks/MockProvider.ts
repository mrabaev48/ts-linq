import type { SqlParameter } from '@ts-linq/types';

export interface DatabaseProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  execute<T = Record<string, unknown>>(sql: string, params: readonly SqlParameter[]): Promise<T[]>;
  beginTransaction(): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
}

export interface MockExecutionResult {
  sql: string;
  params: readonly SqlParameter[];
  result: unknown[];
}

export class MockDatabaseProvider implements DatabaseProvider {
  private executions: MockExecutionResult[] = [];
  private mockResults: Map<string, unknown[]> = new Map();
  private connected = false;

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async execute<T = Record<string, unknown>>(
    sql: string,
    params: readonly SqlParameter[]
  ): Promise<T[]> {
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

    const finalResult = result ?? [];
    this.executions.push({ sql, params, result: finalResult });
    return finalResult as unknown as T[];
  }

  async beginTransaction(): Promise<void> {
    await this.execute('BEGIN TRANSACTION', []);
  }

  async commitTransaction(): Promise<void> {
    await this.execute('COMMIT', []);
  }

  async rollbackTransaction(): Promise<void> {
    await this.execute('ROLLBACK', []);
  }

  mockResult(sql: string, result: unknown[]): void {
    this.mockResults.set(sql, result);
  }

  mockResultPattern(pattern: RegExp, result: unknown[]): void {
    const key = `__regex__${pattern.source}`;
    this.mockResults.set(key, result);
  }

  getExecutions(): MockExecutionResult[] {
    return [...this.executions];
  }

  getLastExecution(): MockExecutionResult | undefined {
    return this.executions[this.executions.length - 1];
  }

  clearExecutions(): void {
    this.executions = [];
  }

  clearMocks(): void {
    this.mockResults.clear();
  }

  reset(): void {
    this.clearExecutions();
    this.clearMocks();
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  expectSql(expectedSql: string): void {
    const last = this.getLastExecution();
    if (!last) {
      throw new Error('No SQL executed');
    }
    if (last.sql !== expectedSql) {
      throw new Error(`Expected SQL: ${expectedSql}\nGot: ${last.sql}`);
    }
  }

  expectParams(expectedParams: readonly SqlParameter[]): void {
    const last = this.getLastExecution();
    if (!last) {
      throw new Error('No SQL executed');
    }
    if (JSON.stringify(last.params) !== JSON.stringify(expectedParams)) {
      throw new Error(
        `Expected params: ${JSON.stringify(expectedParams)}\nGot: ${JSON.stringify(last.params)}`
      );
    }
  }
}

export function createMockProvider(): MockDatabaseProvider {
  return new MockDatabaseProvider();
}
