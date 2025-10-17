import { ConfigLoader } from '../src/ConfigLoader';
import { TsLinqConfig } from '../src/types';

describe('ConfigLoader', () => {
  describe('getDefaults', () => {
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
    });
  });

  describe('validateConfig', () => {
    it('should validate required fields', () => {
      const invalidConfig = {} as TsLinqConfig;
      
      expect(() => {
        (ConfigLoader as any).validateConfig(invalidConfig);
      }).toThrow('Database configuration is required');
    });

    it('should validate provider', () => {
      const invalidConfig = {
        database: {
          provider: 'invalid' as any,
          connection: 'test'
        }
      };
      
      expect(() => {
        (ConfigLoader as any).validateConfig(invalidConfig);
      }).toThrow('Invalid provider');
    });

    it('should accept valid configuration', () => {
      const validConfig: TsLinqConfig = {
        database: {
          provider: 'sqlite',
          connection: ':memory:'
        }
      };
      
      expect(() => {
        (ConfigLoader as any).validateConfig(validConfig);
      }).not.toThrow();
    });
  });

  describe('applyEnvironmentOverrides', () => {
    it('should apply environment-specific config', () => {
      const config: TsLinqConfig = {
        database: {
          provider: 'sqlite',
          connection: ':memory:'
        },
        logging: {
          level: 'info'
        },
        environments: {
          production: {
            logging: {
              level: 'error'
            }
          }
        }
      };

      const result = (ConfigLoader as any).applyEnvironmentOverrides(config, 'production');
      
      expect(result.logging.level).toBe('error');
      expect(result.database.provider).toBe('sqlite');
    });
  });
});
