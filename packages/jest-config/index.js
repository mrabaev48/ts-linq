// Shared Jest config for ts-linq monorepo.
// Exports createJestConfig() for root-level usage and
// createPackageJestConfig() for per-package usage.

const tsLinqTsJestConfig = {
  tsconfig: {
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
    lib: ['ES2021', 'DOM'],
    baseUrl: '.',
    paths: {
      '@ts-linq/types': ['packages/types/dist'],
      '@ts-linq/metadata': ['packages/metadata/dist'],
      '@ts-linq/core': ['packages/core/dist'],
      '@ts-linq/orm': ['packages/orm/dist'],
      '@ts-linq/query': ['packages/query/dist'],
      '@ts-linq/ast': ['packages/ast/dist'],
      '@ts-linq/cache': ['packages/cache/dist'],
      '@ts-linq/cache-memcached': ['packages/cache-memcached/dist'],
      '@ts-linq/cache-redis': ['packages/cache-redis/dist'],
      '@ts-linq/metrics-safe': ['packages/metrics-safe/dist'],
      '@ts-linq/migrations': ['packages/migrations/dist'],
      '@ts-linq/concurrency': ['packages/concurrency/dist'],
      '@ts-linq/config': ['packages/config/dist'],
      '@ts-linq/pagination': ['packages/pagination/dist'],
      '@ts-linq/plugin-audit': ['packages/plugin-audit/dist'],
      '@ts-linq/plugin-multi-tenant': ['packages/plugin-multi-tenant/dist'],
      '@ts-linq/plugin-soft-delete': ['packages/plugin-soft-delete/dist'],
      '@ts-linq/sql-visitor': ['packages/sql-visitor/dist'],
      '@ts-linq/telemetry': ['packages/telemetry/dist'],
      '@ts-linq/dialect-postgres': ['packages/dialect-postgres/dist'],
      '@ts-linq/dialect-mysql': ['packages/dialect-mysql/dist'],
      '@ts-linq/dialect-mssql': ['packages/dialect-mssql/dist'],
      '@ts-linq/provider-postgres': ['packages/provider-postgres/dist'],
      '@ts-linq/provider-mysql': ['packages/provider-mysql/dist'],
      '@ts-linq/provider-mssql': ['packages/provider-mssql/dist'],
      '@ts-linq/testkits': ['packages/testkits/dist'],
      '@ts-linq/composite-sql-logger': ['packages/composite-sql-logger/dist'],
      '@ts-linq/prometheus-sql-logger': ['packages/prometheus-sql-logger/dist'],
      '@ts-linq/open-telemetry-sql-logger': ['packages/open-telemetry-sql-logger/dist'],
      '@ts-linq/integration-nestjs': ['packages/integration-nestjs/dist']
    }
  }
};

const tsLinqModuleNameMapper = {
  '^@ts-linq/types$': '<rootDir>/packages/types/dist',
  '^@ts-linq/metadata$': '<rootDir>/packages/metadata/dist',
  '^@ts-linq/core$': '<rootDir>/packages/core/dist',
  '^@ts-linq/orm$': '<rootDir>/packages/orm/dist',
  '^@ts-linq/query$': '<rootDir>/packages/query/dist',
  '^@ts-linq/cache$': '<rootDir>/packages/cache/dist',
  '^@ts-linq/cache-memcached$': '<rootDir>/packages/cache-memcached/dist',
  '^@ts-linq/cache-redis$': '<rootDir>/packages/cache-redis/dist',
  '^@ts-linq/ast$': '<rootDir>/packages/ast/dist',
  '^@ts-linq/metrics-safe$': '<rootDir>/packages/metrics-safe/dist',
  '^@ts-linq/migrations$': '<rootDir>/packages/migrations/dist',
  '^@ts-linq/concurrency$': '<rootDir>/packages/concurrency/dist',
  '^@ts-linq/config$': '<rootDir>/packages/config/dist',
  '^@ts-linq/pagination$': '<rootDir>/packages/pagination/dist',
  '^@ts-linq/plugin-audit$': '<rootDir>/packages/plugin-audit/dist',
  '^@ts-linq/plugin-multi-tenant$': '<rootDir>/packages/plugin-multi-tenant/dist',
  '^@ts-linq/plugin-soft-delete$': '<rootDir>/packages/plugin-soft-delete/dist',
  '^@ts-linq/sql-visitor$': '<rootDir>/packages/sql-visitor/dist',
  '^@ts-linq/telemetry$': '<rootDir>/packages/telemetry/dist',
  '^@ts-linq/provider-postgres$': '<rootDir>/packages/provider-postgres/dist',
  '^@ts-linq/provider-mysql$': '<rootDir>/packages/provider-mysql/dist',
  '^@ts-linq/provider-mssql$': '<rootDir>/packages/provider-mssql/dist',
  '^@ts-linq/dialect-postgres$': '<rootDir>/packages/dialect-postgres/dist',
  '^@ts-linq/dialect-mysql$': '<rootDir>/packages/dialect-mysql/dist',
  '^@ts-linq/dialect-mssql$': '<rootDir>/packages/dialect-mssql/dist',
  '^@ts-linq/testkits$': '<rootDir>/packages/testkits/dist',
  '^@ts-linq/composite-sql-logger$': '<rootDir>/packages/composite-sql-logger/dist',
  '^@ts-linq/prometheus-sql-logger$': '<rootDir>/packages/prometheus-sql-logger/dist',
  '^@ts-linq/open-telemetry-sql-logger$': '<rootDir>/packages/open-telemetry-sql-logger/dist',
  '^@ts-linq/integration-nestjs$': '<rootDir>/packages/integration-nestjs/dist'
};

/**
 * Base config for root-level jest runs (all packages).
 * Pass overrides to customise roots, setupFiles, etc.
 */
function createJestConfig(overrides) {
  return {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testPathIgnorePatterns: ['/node_modules/', '/tests-old/'],
    transform: { '^.+\\.tsx?$': ['ts-jest', tsLinqTsJestConfig] },
    moduleNameMapper: tsLinqModuleNameMapper,
    collectCoverageFrom: [
      'packages/**/src/**/*.ts',
      '!packages/**/src/**/*.d.ts',
      '!packages/**/tests/**',
      '!packages/**/dist/**'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    testTimeout: 10000,
    ...overrides
  };
}

/**
 * Base config for per-package jest runs.
 * Uses a generic source mapper so tests run against src directly.
 */
function createPackageJestConfig(overrides) {
  return {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    testMatch: ['**/*.test.ts'],
    moduleNameMapper: {
      '^@ts-linq/(.*)$': '<rootDir>/../$1/src'
    },
    collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/index.ts'],
    coveragePathIgnorePatterns: ['/node_modules/', '/dist/'],
    ...overrides
  };
}

module.exports = { createJestConfig, createPackageJestConfig, tsLinqModuleNameMapper, tsLinqTsJestConfig };
