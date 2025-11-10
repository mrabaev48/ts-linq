import type {
  DatabaseConfig,
  MigrationsConfig,
  EntitiesConfig,
  CliConfig,
  LoggingConfig,
  CacheConfig,
  TsLinqConfig,
  ConfigOptions
} from '../src/types';

describe('Config Types', () => {
  describe('DatabaseConfig', () => {
    it('should allow string connection', () => {
      const config: DatabaseConfig = {
        provider: 'sqlite',
        connection: './database.db'
      };
      
      expect(config.connection).toBe('./database.db');
    });

    it('should allow object connection', () => {
      const config: DatabaseConfig = {
        provider: 'postgres',
        connection: {
          host: 'localhost',
          port: 5432,
          database: 'testdb',
          user: 'admin',
          password: 'secret',
          ssl: true
        }
      };
      
      expect(config.connection).toHaveProperty('host', 'localhost');
    });

    it('should support pool configuration', () => {
      const config: DatabaseConfig = {
        provider: 'mysql',
        connection: 'mysql://localhost/test',
        pool: {
          min: 2,
          max: 10,
          acquireTimeoutMillis: 30000,
          idleTimeoutMillis: 10000
        }
      };
      
      expect(config.pool?.min).toBe(2);
      expect(config.pool?.max).toBe(10);
    });

    it('should support all provider types', () => {
      const providers: Array<'sqlite' | 'postgres' | 'mysql' | 'mssql'> = [
        'sqlite',
        'postgres',
        'mysql',
        'mssql'
      ];
      
      providers.forEach(provider => {
        const config: DatabaseConfig = {
          provider,
          connection: './test.db'
        };
        
        expect(config.provider).toBe(provider);
      });
    });
  });

  describe('MigrationsConfig', () => {
    it('should allow all properties as optional', () => {
      const config: MigrationsConfig = {};
      
      expect(config).toBeDefined();
    });

    it('should support all migration properties', () => {
      const config: MigrationsConfig = {
        directory: './migrations',
        tableName: '__schema_migrations',
        pattern: '*.migration.ts',
        transactional: true
      };
      
      expect(config.directory).toBe('./migrations');
      expect(config.tableName).toBe('__schema_migrations');
      expect(config.pattern).toBe('*.migration.ts');
      expect(config.transactional).toBe(true);
    });
  });

  describe('EntitiesConfig', () => {
    it('should allow directory and pattern', () => {
      const config: EntitiesConfig = {
        directory: './src/entities',
        pattern: '**/*.entity.ts'
      };
      
      expect(config.directory).toBe('./src/entities');
      expect(config.pattern).toBe('**/*.entity.ts');
    });

    it('should allow empty config', () => {
      const config: EntitiesConfig = {};
      
      expect(config).toBeDefined();
    });
  });

  describe('CliConfig', () => {
    it('should support all CLI directories', () => {
      const config: CliConfig = {
        migrationsDir: './db/migrations',
        entitiesDir: './src/models',
        seedsDir: './db/seeds'
      };
      
      expect(config.migrationsDir).toBe('./db/migrations');
      expect(config.entitiesDir).toBe('./src/models');
      expect(config.seedsDir).toBe('./db/seeds');
    });
  });

  describe('LoggingConfig', () => {
    it('should support all log levels', () => {
      const levels: Array<'debug' | 'info' | 'warn' | 'error'> = [
        'debug',
        'info',
        'warn',
        'error'
      ];
      
      levels.forEach(level => {
        const config: LoggingConfig = { level };
        expect(config.level).toBe(level);
      });
    });

    it('should support SQL logging and threshold', () => {
      const config: LoggingConfig = {
        level: 'info',
        sql: true,
        slowQueryThreshold: 1000
      };
      
      expect(config.sql).toBe(true);
      expect(config.slowQueryThreshold).toBe(1000);
    });
  });

  describe('CacheConfig', () => {
    it('should support all cache providers', () => {
      const providers: Array<'memory' | 'redis' | 'memcached'> = [
        'memory',
        'redis',
        'memcached'
      ];
      
      providers.forEach(provider => {
        const config: CacheConfig = {
          enabled: true,
          provider
        };
        
        expect(config.provider).toBe(provider);
      });
    });

    it('should support TTL and connection', () => {
      const config: CacheConfig = {
        enabled: true,
        provider: 'redis',
        ttl: 300,
        connection: 'redis://localhost:6379'
      };
      
      expect(config.ttl).toBe(300);
      expect(config.connection).toBe('redis://localhost:6379');
    });
  });

  describe('TsLinqConfig', () => {
    it('should require database configuration', () => {
      const config: TsLinqConfig = {
        database: {
          provider: 'sqlite',
          connection: './test.db'
        }
      };
      
      expect(config.database).toBeDefined();
    });

    it('should support all optional configurations', () => {
      const config: TsLinqConfig = {
        database: {
          provider: 'postgres',
          connection: 'postgresql://localhost/test'
        },
        migrations: {
          directory: './migrations'
        },
        entities: {
          directory: './src/entities'
        },
        cli: {
          migrationsDir: './migrations'
        },
        logging: {
          level: 'info'
        },
        cache: {
          enabled: false
        }
      };
      
      expect(config.migrations).toBeDefined();
      expect(config.entities).toBeDefined();
      expect(config.cli).toBeDefined();
      expect(config.logging).toBeDefined();
      expect(config.cache).toBeDefined();
    });

    it('should support environment-specific overrides', () => {
      const config: TsLinqConfig = {
        database: {
          provider: 'sqlite',
          connection: './dev.db'
        },
        environments: {
          production: {
            database: {
              provider: 'postgres',
              connection: 'postgresql://prod/db'
            }
          },
          test: {
            database: {
              provider: 'sqlite',
              connection: ':memory:'
            }
          }
        }
      };
      
      expect(config.environments?.production).toBeDefined();
      expect(config.environments?.test).toBeDefined();
    });
  });

  describe('ConfigOptions', () => {
    it('should support custom config path', () => {
      const options: ConfigOptions = {
        configPath: './custom-config.json'
      };
      
      expect(options.configPath).toBe('./custom-config.json');
    });

    it('should support environment selection', () => {
      const options: ConfigOptions = {
        environment: 'production'
      };
      
      expect(options.environment).toBe('production');
    });

    it('should support validation flag', () => {
      const options: ConfigOptions = {
        validate: false
      };
      
      expect(options.validate).toBe(false);
    });

    it('should allow empty options', () => {
      const options: ConfigOptions = {};
      
      expect(options).toBeDefined();
    });
  });
});
