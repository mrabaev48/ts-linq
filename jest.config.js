const includeIntegration = !!process.env.RUN_DB_TESTS;

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  detectOpenHandles: true,
  forceExit: true,
  roots: ['<rootDir>/packages'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  moduleNameMapper: {
    // Core & Types
    '^@ts-linq/core$': '<rootDir>/packages/core/src',
    '^@ts-linq/core/(.*)$': '<rootDir>/packages/core/src/$1',
    '^@ts-linq/types$': '<rootDir>/packages/types/src',
    '^@ts-linq/types/(.*)$': '<rootDir>/packages/types/src/$1',
    
    // SQL Dialects
    '^@ts-linq/dialect-postgres$': '<rootDir>/packages/dialect-postgres/src',
    '^@ts-linq/dialect-mysql$': '<rootDir>/packages/dialect-mysql/src',
    '^@ts-linq/dialect-mssql$': '<rootDir>/packages/dialect-mssql/src',
    '^@ts-linq/dialect-sqlite$': '<rootDir>/packages/dialect-sqlite/src',
    
    // Database Providers (NEW names)
    '^@ts-linq/provider-postgres$': '<rootDir>/packages/provider-postgres/src',
    '^@ts-linq/provider-postgres/(.*)$': '<rootDir>/packages/provider-postgres/src/$1',
    '^@ts-linq/provider-mysql$': '<rootDir>/packages/provider-mysql/src',
    '^@ts-linq/provider-mysql/(.*)$': '<rootDir>/packages/provider-mysql/src/$1',
    '^@ts-linq/provider-mssql$': '<rootDir>/packages/provider-mssql/src',
    '^@ts-linq/provider-mssql/(.*)$': '<rootDir>/packages/provider-mssql/src/$1',
    '^@ts-linq/provider-sqlite$': '<rootDir>/packages/provider-sqlite/src',
    '^@ts-linq/provider-sqlite/(.*)$': '<rootDir>/packages/provider-sqlite/src/$1',
    
    // Feature Packages
    '^@ts-linq/ast$': '<rootDir>/packages/ast/src',
    '^@ts-linq/query$': '<rootDir>/packages/query/src',
    '^@ts-linq/cache$': '<rootDir>/packages/cache/src',
    '^@ts-linq/orm$': '<rootDir>/packages/orm/src',
    '^@ts-linq/migrations$': '<rootDir>/packages/migrations/src',
    '^@ts-linq/metadata$': '<rootDir>/packages/metadata/src',
    '^@ts-linq/concurrency$': '<rootDir>/packages/concurrency/src',
    '^@ts-linq/pagination$': '<rootDir>/packages/pagination/src',
    '^@ts-linq/sql-visitor$': '<rootDir>/packages/sql-visitor/src',
    '^@ts-linq/telemetry$': '<rootDir>/packages/telemetry/src',
    '^@ts-linq/testkits$': '<rootDir>/packages/testkits/src',
    '^@ts-linq/config$': '<rootDir>/packages/config/src',
    
    // Observability & Tools
    '^@ts-linq/metrics-safe$': '<rootDir>/packages/metrics-safe/src',
    '^@ts-linq/cache-redis$': '<rootDir>/packages/cache-redis/src',
    '^@ts-linq/cache-memcached$': '<rootDir>/packages/cache-memcached/src',
    '^@ts-linq/cli$': '<rootDir>/packages/cli/src',
    '^@ts-linq/composite-sql-logger$': '<rootDir>/packages/composite-sql-logger/src',
    '^@ts-linq/prometheus-sql-logger$': '<rootDir>/packages/prometheus-sql-logger/src',
    '^@ts-linq/open-telemetry-sql-logger$': '<rootDir>/packages/open-telemetry-sql-logger/src',
    
    // Plugins
    '^@ts-linq/plugin-audit$': '<rootDir>/packages/plugin-audit/src',
    '^@ts-linq/plugin-multi-tenant$': '<rootDir>/packages/plugin-multi-tenant/src',
    '^@ts-linq/plugin-soft-delete$': '<rootDir>/packages/plugin-soft-delete/src',
    
    // Integration & Examples
    '^@ts-linq/integration-nestjs$': '<rootDir>/packages/integration-nestjs/src',
    '^@ts-linq/examples$': '<rootDir>/packages/examples/src',
    '^@ts-linq/e2e-tests$': '<rootDir>/packages/e2e-tests/src',
    
    // Old relative path aliases (still in use by some tests)
    '^@core/(.*)$': '<rootDir>/packages/core/src/$1',
    '^@src/(.*)$': '<rootDir>/$1',
    '^(\\.\\.\/)+src\/(.*)$': '<rootDir>/packages/core/src/$2',
    '^(\\.\\.\/)+context\/(.*)$': '<rootDir>/packages/core/src/context/$2',
    '^(\\.\\.\/)+metadata\/(.*)$': '<rootDir>/packages/core/src/metadata/$2',
    '^(\\.\\.\/)+types$': '<rootDir>/packages/core/src/types',
    '^(\\.\\.\/)+DatabaseProvider$': '<rootDir>/packages/core/src/DatabaseProvider',
    '^(\\.\\.\/)+query\/(.*)$': '<rootDir>/packages/core/src/query/$2',
    '^(\\.\\.\/)+decorators\/(.*)$': '<rootDir>/packages/core/src/decorators/$2',
    '^(\\.\\.\/)+migrations\/(.*)$': '<rootDir>/packages/core/src/migrations/$2',
    '^(\\.\\.\/)+utils\/(.*)$': '<rootDir>/packages/core/src/utils/$2'
  },
  globals: {
    'ts-jest': {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }
  },
  testPathIgnorePatterns: includeIntegration ? [] : ['integration\\.test\\.ts$'],
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
    '!packages/*/src/**/*.d.ts',
    '!packages/*/src/**/*.test.ts',
    '!packages/*/src/**/*.spec.ts'
  ],
  setupFilesAfterEnv: ['<rootDir>/packages/core/tests/setup.ts'],
  testTimeout: 10000,
  projects: [
    {
      displayName: 'core',
      testMatch: ['<rootDir>/packages/core/{src,tests}/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.tests.json', diagnostics: false, isolatedModules: true }] }
    },
    {
      displayName: 'provider-sqlite',
      testMatch: ['<rootDir>/packages/provider-sqlite/{src,tests}/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.tests.json' }] }
    },
    {
      displayName: 'provider-postgres',
      testMatch: ['<rootDir>/packages/provider-postgres/{src,tests}/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.tests.json' }] }
    },
    {
      displayName: 'cli',
      testMatch: ['<rootDir>/packages/cli/{src,tests}/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.tests.json' }] }
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/packages/e2e-tests/tests/**/*.e2e.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.tests.json' }] },
      testTimeout: 30000
    }
  ]
};
