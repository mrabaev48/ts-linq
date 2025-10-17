import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import type { TsLinqConfig, ConfigOptions } from './types';

export class ConfigLoader {
  private static DEFAULT_PATHS = [
    'ts-linq.config.ts',
    'ts-linq.config.js',
    'ts-linq.config.json',
    '.ts-linq.config.ts',
    '.ts-linq.config.js',
    '.ts-linq.config.json'
  ];

  static async load(options: ConfigOptions = {}): Promise<TsLinqConfig> {
    const configPath = this.findConfigFile(options.configPath);
    
    if (!configPath) {
      throw new Error(
        'Configuration file not found. Please create ts-linq.config.ts|js|json in your project root.'
      );
    }

    const config = await this.loadConfigFile(configPath);
    const environment = options.environment || process.env.NODE_ENV || 'development';
    
    // Apply environment-specific overrides
    const finalConfig = this.applyEnvironmentOverrides(config, environment);
    
    if (options.validate !== false) {
      this.validateConfig(finalConfig);
    }
    
    return finalConfig;
  }

  private static findConfigFile(customPath?: string): string | null {
    if (customPath) {
      const resolved = resolve(process.cwd(), customPath);
      return existsSync(resolved) ? resolved : null;
    }

    for (const path of this.DEFAULT_PATHS) {
      const resolved = resolve(process.cwd(), path);
      if (existsSync(resolved)) {
        return resolved;
      }
    }

    return null;
  }

  private static async loadConfigFile(path: string): Promise<TsLinqConfig> {
    if (path.endsWith('.json')) {
      const content = readFileSync(path, 'utf-8');
      return JSON.parse(content);
    }

    // For .ts/.js files, use dynamic import
    const module = await import(path);
    return module.default || module;
  }

  private static applyEnvironmentOverrides(
    config: TsLinqConfig,
    environment: string
  ): TsLinqConfig {
    if (!config.environments || !config.environments[environment]) {
      return config;
    }

    const envOverrides = config.environments[environment];
    return this.deepMerge(config, envOverrides);
  }

  private static deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  private static validateConfig(config: TsLinqConfig): void {
    if (!config.database) {
      throw new Error('Database configuration is required');
    }

    if (!config.database.provider) {
      throw new Error('Database provider is required');
    }

    const validProviders = ['sqlite', 'postgres', 'mysql', 'mssql'];
    if (!validProviders.includes(config.database.provider)) {
      throw new Error(
        `Invalid provider: ${config.database.provider}. Must be one of: ${validProviders.join(', ')}`
      );
    }

    if (!config.database.connection) {
      throw new Error('Database connection is required');
    }
  }

  static getDefaults(): Partial<TsLinqConfig> {
    return {
      migrations: {
        directory: './migrations',
        tableName: '__migrations',
        pattern: '**/*.ts',
        transactional: true
      },
      entities: {
        directory: './src/entities',
        pattern: '**/*.entity.ts'
      },
      cli: {
        migrationsDir: './migrations',
        entitiesDir: './src/entities',
        seedsDir: './seeds'
      },
      logging: {
        level: 'info',
        sql: false,
        slowQueryThreshold: 1000
      },
      cache: {
        enabled: false,
        provider: 'memory',
        ttl: 300
      }
    };
  }
}
