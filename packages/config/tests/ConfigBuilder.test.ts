import { ConfigBuilder } from '../src/ConfigBuilder';

describe('ConfigBuilder', () => {
  it('should build SQLite configuration', () => {
    const config = ConfigBuilder
      .sqlite(':memory:')
      .migrations({ directory: './db/migrations' })
      .entities('./src/models')
      .build();

    expect(config.database.provider).toBe('sqlite');
    expect(config.database.connection).toBe(':memory:');
    expect(config.migrations?.directory).toBe('./db/migrations');
  });

  it('should build PostgreSQL configuration', () => {
    const config = ConfigBuilder
      .postgres('postgres://localhost/testdb')
      .logging('debug', true)
      .cache(true, 'redis')
      .build();

    expect(config.database.provider).toBe('postgres');
    expect(config.logging?.level).toBe('debug');
    expect(config.logging?.sql).toBe(true);
    expect(config.cache?.enabled).toBe(true);
  });

  it('should support environment overrides', () => {
    const config = ConfigBuilder
      .sqlite(':memory:')
      .environment('production', {
        database: {
          provider: 'postgres',
          connection: 'postgres://prod/db'
        }
      })
      .build();

    expect(config.environments).toBeDefined();
    expect(config.environments?.production?.database?.provider).toBe('postgres');
  });

  it('should throw error if database not configured', () => {
    const builder = new ConfigBuilder();
    
    expect(() => builder.build()).toThrow('Database configuration is required');
  });
});
