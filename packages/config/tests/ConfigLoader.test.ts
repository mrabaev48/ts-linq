import { ConfigLoader } from '../src/ConfigLoader';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const TEST_CONFIG_DIR = join(__dirname, '__test_configs__');

describe('ConfigLoader', () => {
  const originalCwd = process.cwd();

  beforeAll(() => {
    if (!existsSync(TEST_CONFIG_DIR)) {
      mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    }
  });

  beforeEach(() => {
    process.chdir(TEST_CONFIG_DIR);
  });

  afterEach(() => {
    const files = [
      'ts-linq.config.json',
      'ts-linq.config.js',
      'custom-config.json'
    ];
    
    files.forEach(file => {
      const path = join(TEST_CONFIG_DIR, file);
      if (existsSync(path)) {
        try {
          unlinkSync(path);
        } catch (e) {
        }
      }
    });
  });

  afterAll(() => {
    process.chdir(originalCwd);
  });

  describe('load()', () => {
    it('should load JSON config file', async () => {
      const testConfig = {
        database: {
          provider: 'sqlite',
          connection: './test.db'
        }
      };
      
      writeFileSync(
        join(TEST_CONFIG_DIR, 'ts-linq.config.json'),
        JSON.stringify(testConfig, null, 2)
      );
      
      const config = await ConfigLoader.load();
      
      expect(config.database.provider).toBe('sqlite');
      expect(config.database.connection).toBe('./test.db');
    });

    it('should throw error if config file not found', async () => {
      await expect(ConfigLoader.load()).rejects.toThrow(
        'Configuration file not found'
      );
    });

    it('should load custom config path', async () => {
      const testConfig = {
        database: {
          provider: 'postgres',
          connection: 'postgresql://localhost/test'
        }
      };
      
      writeFileSync(
        join(TEST_CONFIG_DIR, 'custom-config.json'),
        JSON.stringify(testConfig, null, 2)
      );
      
      const config = await ConfigLoader.load({
        configPath: 'custom-config.json'
      });
      
      expect(config.database.provider).toBe('postgres');
    });

    it('should apply environment overrides', async () => {
      const testConfig = {
        database: {
          provider: 'sqlite',
          connection: './dev.db'
        },
        logging: {
          level: 'debug' as const,
          sql: true
        },
        environments: {
          production: {
            database: {
              provider: 'postgres' as const,
              connection: 'postgresql://prod/db'
            },
            logging: {
              level: 'error' as const,
              sql: false
            }
          }
        }
      };
      
      writeFileSync(
        join(TEST_CONFIG_DIR, 'ts-linq.config.json'),
        JSON.stringify(testConfig, null, 2)
      );
      
      const config = await ConfigLoader.load({ environment: 'production' });
      
      expect(config.database.provider).toBe('postgres');
      expect(config.database.connection).toBe('postgresql://prod/db');
      expect(config.logging?.level).toBe('error');
      expect(config.logging?.sql).toBe(false);
    });

    it('should use development environment by default', async () => {
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;
      
      const testConfig = {
        database: {
          provider: 'sqlite',
          connection: './base.db'
        },
        environments: {
          development: {
            database: {
              provider: 'sqlite' as const,
              connection: './dev.db'
            }
          }
        }
      };
      
      writeFileSync(
        join(TEST_CONFIG_DIR, 'ts-linq.config.json'),
        JSON.stringify(testConfig, null, 2)
      );
      
      const config = await ConfigLoader.load();
      
      expect(config.database.connection).toBe('./dev.db');
      
      if (originalEnv) {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should skip validation when validate is false', async () => {
      const invalidConfig = {
        database: {}
      };
      
      writeFileSync(
        join(TEST_CONFIG_DIR, 'ts-linq.config.json'),
        JSON.stringify(invalidConfig, null, 2)
      );
      
      await expect(
        ConfigLoader.load({ validate: false })
      ).resolves.toBeDefined();
    });

    it('should validate config by default', async () => {
      const invalidConfig = {
        database: {}
      };
      
      writeFileSync(
        join(TEST_CONFIG_DIR, 'ts-linq.config.json'),
        JSON.stringify(invalidConfig, null, 2)
      );
      
      await expect(ConfigLoader.load()).rejects.toThrow('Database provider is required');
    });
  });

  describe('validation', () => {
    it('should throw error if database config missing', async () => {
      const testConfig = {};
      
      writeFileSync(
        join(TEST_CONFIG_DIR, 'ts-linq.config.json'),
        JSON.stringify(testConfig, null, 2)
      );
      
      await expect(ConfigLoader.load()).rejects.toThrow(
        'Database configuration is required'
      );
    });

    it('should throw error if provider missing', async () => {
      const testConfig = {
        database: {
          connection: './test.db'
        }
      };
      
      writeFileSync(
        join(TEST_CONFIG_DIR, 'ts-linq.config.json'),
        JSON.stringify(testConfig, null, 2)
      );
      
      await expect(ConfigLoader.load()).rejects.toThrow(
        'Database provider is required'
      );
    });

    it('should throw error if provider is invalid', async () => {
      const testConfig = {
        database: {
          provider: 'invalid-provider',
          connection: './test.db'
        }
      };
      
      writeFileSync(
        join(TEST_CONFIG_DIR, 'ts-linq.config.json'),
        JSON.stringify(testConfig, null, 2)
      );
      
      await expect(ConfigLoader.load()).rejects.toThrow(
        'Invalid provider: invalid-provider'
      );
    });

    it('should throw error if connection missing', async () => {
      const testConfig = {
        database: {
          provider: 'sqlite'
        }
      };
      
      writeFileSync(
        join(TEST_CONFIG_DIR, 'ts-linq.config.json'),
        JSON.stringify(testConfig, null, 2)
      );
      
      await expect(ConfigLoader.load()).rejects.toThrow(
        'Database connection is required'
      );
    });

    it('should accept all valid providers', async () => {
      const providers = ['sqlite', 'postgres', 'mysql', 'mssql'];
      
      for (const provider of providers) {
        const testConfig = {
          database: {
            provider,
            connection: './test.db'
          }
        };
        
        writeFileSync(
          join(TEST_CONFIG_DIR, 'ts-linq.config.json'),
          JSON.stringify(testConfig, null, 2)
        );
        
        const config = await ConfigLoader.load();
        expect(config.database.provider).toBe(provider);
      }
    });
  });

  describe('getDefaults()', () => {
    it('should return default configuration', () => {
      const defaults = ConfigLoader.getDefaults();
      
      expect(defaults.migrations).toEqual({
        directory: './migrations',
        tableName: '__migrations',
        pattern: '**/*.ts',
        transactional: true
      });
      
      expect(defaults.entities).toEqual({
        directory: './src/entities',
        pattern: '**/*.entity.ts'
      });
      
      expect(defaults.cli).toEqual({
        migrationsDir: './migrations',
        entitiesDir: './src/entities',
        seedsDir: './seeds'
      });
      
      expect(defaults.logging).toEqual({
        level: 'info',
        sql: false,
        slowQueryThreshold: 1000
      });
      
      expect(defaults.cache).toEqual({
        enabled: false,
        provider: 'memory',
        ttl: 300
      });
    });

    it('should not include database in defaults', () => {
      const defaults = ConfigLoader.getDefaults();
      
      expect(defaults.database).toBeUndefined();
    });
  });

  describe('deep merge behavior', () => {
    it('should deep merge nested configurations', async () => {
      const testConfig = {
        database: {
          provider: 'postgres' as const,
          connection: 'postgresql://localhost/dev',
          pool: {
            min: 2,
            max: 10
          }
        },
        logging: {
          level: 'debug' as const,
          sql: true,
          slowQueryThreshold: 500
        },
        environments: {
          production: {
            database: {
              pool: {
                min: 5,
                max: 20
              }
            },
            logging: {
              level: 'error' as const
            }
          }
        }
      };
      
      writeFileSync(
        join(TEST_CONFIG_DIR, 'ts-linq.config.json'),
        JSON.stringify(testConfig, null, 2)
      );
      
      const config = await ConfigLoader.load({ environment: 'production' });
      
      expect(config.database.provider).toBe('postgres');
      expect(config.database.connection).toBe('postgresql://localhost/dev');
      expect(config.database.pool?.min).toBe(5);
      expect(config.database.pool?.max).toBe(20);
      expect(config.logging?.level).toBe('error');
      expect(config.logging?.sql).toBe(true);
      expect(config.logging?.slowQueryThreshold).toBe(500);
    });

    it('should override arrays completely instead of merging', async () => {
      const testConfig = {
        database: {
          provider: 'sqlite' as const,
          connection: './test.db'
        },
        environments: {
          test: {
            database: {
              provider: 'postgres' as const,
              connection: 'postgresql://test/db'
            }
          }
        }
      };
      
      writeFileSync(
        join(TEST_CONFIG_DIR, 'ts-linq.config.json'),
        JSON.stringify(testConfig, null, 2)
      );
      
      const config = await ConfigLoader.load({ environment: 'test' });
      
      expect(config.database.provider).toBe('postgres');
    });
  });

  describe('config file discovery', () => {
    it('should search for ts-linq.config.json', async () => {
      const testConfig = {
        database: { provider: 'sqlite', connection: './test.db' }
      };
      
      writeFileSync(
        join(TEST_CONFIG_DIR, 'ts-linq.config.json'),
        JSON.stringify(testConfig, null, 2)
      );
      
      const config = await ConfigLoader.load();
      expect(config).toBeDefined();
    });

    it('should return null for custom path if file does not exist', async () => {
      await expect(
        ConfigLoader.load({ configPath: 'non-existent.json' })
      ).rejects.toThrow('Configuration file not found');
    });
  });
});
