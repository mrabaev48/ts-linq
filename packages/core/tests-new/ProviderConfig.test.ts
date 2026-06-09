import { describe, expect, it, jest } from '@jest/globals';
import type { CircuitEventInfo, EntityMetadata, SqlDialect, SqlLogger } from '@ts-linq/types';
import { ValidationError } from '@ts-linq/types';

import { DatabaseProvider } from '../src/DatabaseProvider';
import { ProviderConfig } from '../src/ProviderConfig';

class NoopDialect implements SqlDialect {
  public quoteIdentifier(identifier: string): string {
    return `"${identifier}"`;
  }
  public buildSelect(): { query: string; parameters: [] } {
    return { query: '', parameters: [] };
  }
}

/** Minimal concrete provider constructed via a ProviderConfig. */
class ConfiguredProvider extends DatabaseProvider {
  protected async doConnect(): Promise<void> {}
  protected async doDisconnect(): Promise<void> {}
  public async createTable(_m: EntityMetadata): Promise<void> {}
  public getDialect(): SqlDialect {
    return new NoopDialect();
  }
  public async insert<T extends object>(e: T): Promise<T> {
    return e;
  }
  public async update<T extends object>(e: T): Promise<T> {
    return e;
  }
  public async delete<T extends object>(): Promise<void> {}
  public async findById<T extends object>(): Promise<T | null> {
    return null;
  }
  public async findAll<T extends object>(): Promise<T[]> {
    return [];
  }
  public async findWhere<T extends object>(): Promise<T[]> {
    return [];
  }
  public async findWhereIn<T extends object>(): Promise<T[]> {
    return [];
  }
  protected async doExecuteQuery<T>(): Promise<T[]> {
    return [];
  }
  protected async doExecuteNonQuery(): Promise<number> {
    return 0;
  }
  protected async doBeginTransaction(): Promise<void> {}
  protected async doCommitTransaction(): Promise<void> {}
  protected async doRollbackTransaction(): Promise<void> {}
}

describe('ProviderConfig', () => {
  it('requires a non-empty providerName', () => {
    expect(() => new ProviderConfig({ providerName: '', connectionString: 'c' })).toThrow(
      ValidationError
    );
    expect(() => new ProviderConfig({ providerName: '   ', connectionString: 'c' })).toThrow(
      ValidationError
    );
  });

  it('carries the supplied options', () => {
    const logger: SqlLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    const config = new ProviderConfig({
      providerName: 'postgresql',
      connectionString: 'postgres://x',
      logger,
      circuitOptions: { failureThreshold: 3 }
    });

    expect(config.providerName).toBe('postgresql');
    expect(config.connectionString).toBe('postgres://x');
    expect(config.logger).toBe(logger);
    expect(config.circuitOptions).toEqual({ failureThreshold: 3 });
  });

  it('exposes providerName via the provider label', () => {
    const provider = new ConfiguredProvider(
      new ProviderConfig({ providerName: 'test-db', connectionString: 'c' })
    );
    expect(provider.providerLabel).toBe('test-db');
  });

  it('labels resilience telemetry with the real provider name (latent bug fixed)', () => {
    // Regression for the former constructor bug: ResilienceManager/HealthMonitor
    // were built with providerName === 'unknown' because subclasses only set the
    // real name AFTER super() returned. With ProviderConfig the name is known up
    // front, so circuit events carry the real provider label.
    const events: CircuitEventInfo[] = [];
    const logger: SqlLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      circuit: (info) => events.push(info)
    };

    const provider = new ConfiguredProvider(
      new ProviderConfig({ providerName: 'test-db', connectionString: 'c', logger })
    );
    provider.forceOpen('boom');

    expect(events.length).toBeGreaterThan(0);
    expect(events[0].provider).toBe('test-db');
  });

  it('still supports the deprecated positional constructor (provider name "unknown")', () => {
    const events: CircuitEventInfo[] = [];
    const logger: SqlLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      circuit: (info) => events.push(info)
    };

    const provider = new ConfiguredProvider('c', logger);
    provider.forceOpen('boom');

    expect(provider.providerLabel).toBe('unknown');
    expect(events[0].provider).toBe('unknown');
  });
});
