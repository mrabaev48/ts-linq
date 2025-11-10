import { ConfigBuilder } from '../src/ConfigBuilder';
import type { TsLinqConfig } from '../src/types';

describe('ConfigBuilder', () => {
  describe('database()', () => {
    it('should set database configuration', () => {
      const builder = new ConfigBuilder();
      const dbConfig = {
        provider: 'sqlite' as const,
        connection: './test.db'
      };
      
      builder.database(dbConfig);
      const config = builder.build();
      
      expect(config.database).toEqual(dbConfig);
    });

    it('should support fluent chaining', () => {
      const builder = new ConfigBuilder();
      const result = builder.database({
        provider: 'postgres',
        connection: 'postgresql://localhost/test'
      });
      
      expect(result).toBe(builder);
    });

    it('should handle object connection config', () => {
      const builder = new ConfigBuilder();
      const dbConfig = {
        provider: 'postgres' as const,
        connection: {
          host: 'localhost',
          port: 5432,
          database: 'testdb',
          user: 'admin',
          password: 'secret',
          ssl: true
        }
      };
      
      builder.database(dbConfig);
      const config = builder.build();
      
      expect(config.database).toEqual(dbConfig);
    });

    it('should handle pool configuration', () => {
      const builder = new ConfigBuilder();
      const dbConfig = {
        provider: 'mysql' as const,
        connection: 'mysql://localhost/test',
        pool: {
          min: 2,
          max: 10,
          acquireTimeoutMillis: 30000,
          idleTimeoutMillis: 10000
        }
      };
      
      builder.database(dbConfig);
      const config = builder.build();
      
      expect(config.database.pool).toEqual(dbConfig.pool);
    });
  });

  describe('migrations()', () => {
    it('should set migrations configuration', () => {
      const builder = new ConfigBuilder()
        .database({ provider: 'sqlite', connection: './test.db' });
      
      const migrationsConfig = {
        directory: './custom-migrations',
        tableName: '__custom_migrations',
        pattern: '*.migration.ts',
        transactional: false
      };
      
      builder.migrations(migrationsConfig);
      const config = builder.build();
      
      expect(config.migrations).toEqual(migrationsConfig);
    });

    it('should support fluent chaining', () => {
      const builder = new ConfigBuilder()
        .database({ provider: 'sqlite', connection: './test.db' });
      
      const result = builder.migrations({ directory: './migrations' });
      
      expect(result).toBe(builder);
    });
  });

  describe('entities()', () => {
    it('should set entities configuration with directory and pattern', () => {
      const builder = new ConfigBuilder()
        .database({ provider: 'sqlite', connection: './test.db' });
      
      builder.entities('./src/models', '**/*.model.ts');
      const config = builder.build();
      
      expect(config.entities).toEqual({
        directory: './src/models',
        pattern: '**/*.model.ts'
      });
    });

    it('should use default pattern when not provided', () => {
      const builder = new ConfigBuilder()
        .database({ provider: 'sqlite', connection: './test.db' });
      
      builder.entities('./src/entities');
      const config = builder.build();
      
      expect(config.entities).toEqual({
        directory: './src/entities',
        pattern: '**/*.entity.ts'
      });
    });

    it('should support fluent chaining', () => {
      const builder = new ConfigBuilder()
        .database({ provider: 'sqlite', connection: './test.db' });
      
      const result = builder.entities('./src/entities');
      
      expect(result).toBe(builder);
    });
  });

  describe('cli()', () => {
    it('should set CLI configuration', () => {
      const builder = new ConfigBuilder()
        .database({ provider: 'sqlite', connection: './test.db' });
      
      builder.cli('./custom-migrations', './custom-entities');
      const config = builder.build();
      
      expect(config.cli).toEqual({
        migrationsDir: './custom-migrations',
        entitiesDir: './custom-entities'
      });
    });

    it('should use defaults when parameters not provided', () => {
      const builder = new ConfigBuilder()
        .database({ provider: 'sqlite', connection: './test.db' });
      
      builder.cli();
      const config = builder.build();
      
      expect(config.cli).toEqual({
        migrationsDir: './migrations',
        entitiesDir: './src/entities'
      });
    });

    it('should support fluent chaining', () => {
      const builder = new ConfigBuilder()
        .database({ provider: 'sqlite', connection: './test.db' });
      
      const result = builder.cli();
      
      expect(result).toBe(builder);
    });
  });

  describe('logging()', () => {
    it('should set logging configuration', () => {
      const builder = new ConfigBuilder()
        .database({ provider: 'sqlite', connection: './test.db' });
      
      builder.logging('debug', true);
      const config = builder.build();
      
      expect(config.logging).toEqual({
        level: 'debug',
        sql: true
      });
    });

    it('should use defaults when parameters not provided', () => {
      const builder = new ConfigBuilder()
        .database({ provider: 'sqlite', connection: './test.db' });
      
      builder.logging();
      const config = builder.build();
      
      expect(config.logging).toEqual({
        level: 'info',
        sql: false
      });
    });

    it('should handle explicit false for sql logging', () => {
      const builder = new ConfigBuilder()
        .database({ provider: 'sqlite', connection: './test.db' });
      
      builder.logging('warn', false);
      const config = builder.build();
      
      expect(config.logging?.sql).toBe(false);
    });

    it('should support fluent chaining', () => {
      const builder = new ConfigBuilder()
        .database({ provider: 'sqlite', connection: './test.db' });
      
      const result = builder.logging('info');
      
      expect(result).toBe(builder);
    });
  });

  describe('cache()', () => {
    it('should set cache configuration', () => {
      const builder = new ConfigBuilder()
        .database({ provider: 'sqlite', connection: './test.db' });
      
      builder.cache(true, 'redis');
      const config = builder.build();
      
      expect(config.cache).toEqual({
        enabled: true,
        provider: 'redis'
      });
    });

    it('should use default provider when not specified', () => {
      const builder = new ConfigBuilder()
        .database({ provider: 'sqlite', connection: './test.db' });
      
      builder.cache(true);
      const config = builder.build();
      
      expect(config.cache).toEqual({
        enabled: true,
        provider: 'memory'
      });
    });

    it('should allow disabling cache', () => {
      const builder = new ConfigBuilder()
        .database({ provider: 'sqlite', connection: './test.db' });
      
      builder.cache(false);
      const config = builder.build();
      
      expect(config.cache?.enabled).toBe(false);
    });

    it('should support fluent chaining', () => {
      const builder = new ConfigBuilder()
        .database({ provider: 'sqlite', connection: './test.db' });
      
      const result = builder.cache(true, 'memcached');
      
      expect(result).toBe(builder);
    });
  });

  describe('environment()', () => {
    it('should add environment-specific overrides', () => {
      const builder = new ConfigBuilder()
        .database({ provider: 'sqlite', connection: './test.db' });
      
      const prodOverrides: Partial<TsLinqConfig> = {
        database: {
          provider: 'postgres',
          connection: 'postgresql://prod-server/db'
        }
      };
      
      builder.environment('production', prodOverrides);
      const config = builder.build();
      
      expect(config.environments).toEqual({
        production: prodOverrides
      });
    });

    it('should support multiple environments', () => {
      const builder = new ConfigBuilder()
        .database({ provider: 'sqlite', connection: './test.db' });
      
      builder
        .environment('development', { logging: { level: 'debug', sql: true } })
        .environment('production', { logging: { level: 'error', sql: false } });
      
      const config = builder.build();
      
      expect(config.environments).toHaveProperty('development');
      expect(config.environments).toHaveProperty('production');
    });

    it('should support fluent chaining', () => {
      const builder = new ConfigBuilder()
        .database({ provider: 'sqlite', connection: './test.db' });
      
      const result = builder.environment('test', {});
      
      expect(result).toBe(builder);
    });
  });

  describe('build()', () => {
    it('should throw error if database not configured', () => {
      const builder = new ConfigBuilder();
      
      expect(() => builder.build()).toThrow('Database configuration is required');
    });

    it('should return complete config', () => {
      const config = new ConfigBuilder()
        .database({ provider: 'sqlite', connection: './test.db' })
        .migrations({ directory: './migrations' })
        .entities('./src/entities')
        .cli()
        .logging('info', true)
        .cache(true, 'redis')
        .build();
      
      expect(config.database).toBeDefined();
      expect(config.migrations).toBeDefined();
      expect(config.entities).toBeDefined();
      expect(config.cli).toBeDefined();
      expect(config.logging).toBeDefined();
      expect(config.cache).toBeDefined();
    });

    it('should allow partial configuration', () => {
      const config = new ConfigBuilder()
        .database({ provider: 'sqlite', connection: './test.db' })
        .build();
      
      expect(config.database).toBeDefined();
      expect(config.migrations).toBeUndefined();
      expect(config.entities).toBeUndefined();
    });
  });

  describe('static helper methods', () => {
    describe('sqlite()', () => {
      it('should create builder with SQLite configuration', () => {
        const config = ConfigBuilder.sqlite('./database.db').build();
        
        expect(config.database).toEqual({
          provider: 'sqlite',
          connection: './database.db'
        });
      });

      it('should return ConfigBuilder instance', () => {
        const builder = ConfigBuilder.sqlite('./test.db');
        
        expect(builder).toBeInstanceOf(ConfigBuilder);
      });

      it('should allow further chaining', () => {
        const config = ConfigBuilder.sqlite('./test.db')
          .logging('debug', true)
          .build();
        
        expect(config.database.provider).toBe('sqlite');
        expect(config.logging?.level).toBe('debug');
      });
    });

    describe('postgres()', () => {
      it('should create builder with PostgreSQL configuration', () => {
        const config = ConfigBuilder.postgres('postgresql://localhost/testdb').build();
        
        expect(config.database).toEqual({
          provider: 'postgres',
          connection: 'postgresql://localhost/testdb'
        });
      });

      it('should return ConfigBuilder instance', () => {
        const builder = ConfigBuilder.postgres('postgresql://localhost/test');
        
        expect(builder).toBeInstanceOf(ConfigBuilder);
      });
    });

    describe('mysql()', () => {
      it('should create builder with MySQL string configuration', () => {
        const config = ConfigBuilder.mysql('mysql://localhost/testdb').build();
        
        expect(config.database).toEqual({
          provider: 'mysql',
          connection: 'mysql://localhost/testdb'
        });
      });

      it('should create builder with MySQL object configuration', () => {
        const connObj = {
          host: 'localhost',
          port: 3306,
          database: 'testdb',
          user: 'root'
        };
        
        const config = ConfigBuilder.mysql(connObj).build();
        
        expect(config.database).toEqual({
          provider: 'mysql',
          connection: connObj
        });
      });

      it('should return ConfigBuilder instance', () => {
        const builder = ConfigBuilder.mysql('mysql://localhost/test');
        
        expect(builder).toBeInstanceOf(ConfigBuilder);
      });
    });

    describe('mssql()', () => {
      it('should create builder with MSSQL string configuration', () => {
        const config = ConfigBuilder.mssql('mssql://localhost/testdb').build();
        
        expect(config.database).toEqual({
          provider: 'mssql',
          connection: 'mssql://localhost/testdb'
        });
      });

      it('should create builder with MSSQL object configuration', () => {
        const connObj = {
          host: 'localhost',
          port: 1433,
          database: 'testdb',
          user: 'sa'
        };
        
        const config = ConfigBuilder.mssql(connObj).build();
        
        expect(config.database).toEqual({
          provider: 'mssql',
          connection: connObj
        });
      });

      it('should return ConfigBuilder instance', () => {
        const builder = ConfigBuilder.mssql('mssql://localhost/test');
        
        expect(builder).toBeInstanceOf(ConfigBuilder);
      });
    });
  });

  describe('complex configuration scenarios', () => {
    it('should build complete multi-environment config', () => {
      const config = ConfigBuilder.postgres('postgresql://localhost/dev')
        .migrations({
          directory: './db/migrations',
          tableName: '__schema_migrations',
          transactional: true
        })
        .entities('./src/models', '**/*.model.ts')
        .cli('./db/migrations', './src/models')
        .logging('debug', true)
        .cache(true, 'redis')
        .environment('production', {
          database: {
            provider: 'postgres',
            connection: {
              host: 'prod.example.com',
              port: 5432,
              database: 'production',
              user: 'app_user',
              ssl: true
            },
            pool: {
              min: 5,
              max: 20
            }
          },
          logging: { level: 'error', sql: false }
        })
        .environment('test', {
          database: {
            provider: 'sqlite',
            connection: ':memory:'
          }
        })
        .build();
      
      expect(config.database.provider).toBe('postgres');
      expect(config.environments?.production).toBeDefined();
      expect(config.environments?.test).toBeDefined();
      expect(config.migrations?.directory).toBe('./db/migrations');
      expect(config.cache?.enabled).toBe(true);
    });
  });
});
