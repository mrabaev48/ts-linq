// Shared Jest config for ts-linq monorepo.
// Exports createJestConfig() for root-level usage and
// createPackageJestConfig() for per-package usage.

const tsLinqTsJestConfig = {
  astTransformers: {
    before: [{ path: require.resolve('./jest-transformer.js') }]
  },
  tsconfig: {
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
    lib: ['ES2021', 'ES2022.Error', 'DOM'],
    baseUrl: '.',
    paths: {
      '@ts-linq/types': ['packages/types/src'],
      '@ts-linq/metadata': ['packages/metadata/src'],
      '@ts-linq/core': ['packages/core/src'],
      '@ts-linq/orm/internal': ['packages/orm/src/internal'],
      '@ts-linq/orm': ['packages/orm/src'],
      '@ts-linq/query': ['packages/query/src'],
      '@ts-linq/query/internal': ['packages/query/src/internal'],
      '@ts-linq/ast': ['packages/ast/src'],
      '@ts-linq/cache': ['packages/cache/src'],
      '@ts-linq/cache-memcached': ['packages/cache-memcached/src'],
      '@ts-linq/cache-redis': ['packages/cache-redis/src'],
      '@ts-linq/metrics-safe': ['packages/metrics-safe/src'],
      '@ts-linq/migrations': ['packages/migrations/src'],
      '@ts-linq/concurrency': ['packages/concurrency/src'],
      '@ts-linq/config': ['packages/config/src'],
      '@ts-linq/pagination': ['packages/pagination/src'],
      '@ts-linq/plugin-audit': ['packages/plugin-audit/src'],
      '@ts-linq/plugin-multi-tenant': ['packages/plugin-multi-tenant/src'],
      '@ts-linq/plugin-soft-delete': ['packages/plugin-soft-delete/src'],
      '@ts-linq/sql-visitor': ['packages/sql-visitor/src'],
      '@ts-linq/sql-visitor/internal': ['packages/sql-visitor/src/internal'],
      '@ts-linq/telemetry': ['packages/telemetry/src'],
      '@ts-linq/dialect-postgres': ['packages/dialect-postgres/src'],
      '@ts-linq/dialect-mysql': ['packages/dialect-mysql/src'],
      '@ts-linq/dialect-mssql': ['packages/dialect-mssql/src'],
      '@ts-linq/provider-postgres': ['packages/provider-postgres/src'],
      '@ts-linq/provider-mysql': ['packages/provider-mysql/src'],
      '@ts-linq/provider-mssql': ['packages/provider-mssql/src'],
      '@ts-linq/testkits': ['packages/testkits/src'],
      '@ts-linq/composite-sql-logger': ['packages/composite-sql-logger/src'],
      '@ts-linq/prometheus-sql-logger': ['packages/prometheus-sql-logger/src'],
      '@ts-linq/open-telemetry-sql-logger': ['packages/open-telemetry-sql-logger/src'],
      '@ts-linq/integration-nestjs': ['packages/integration-nestjs/src']
    }
  }
};

const tsLinqModuleNameMapper = {
  '^@ts-linq/types$': '<rootDir>/packages/types/src',
  '^@ts-linq/metadata$': '<rootDir>/packages/metadata/src',
  '^@ts-linq/core$': '<rootDir>/packages/core/src',
  '^@ts-linq/orm/internal$': '<rootDir>/packages/orm/src/internal',
  '^@ts-linq/orm$': '<rootDir>/packages/orm/src',
  '^@ts-linq/query/internal$': '<rootDir>/packages/query/src/internal',
  '^@ts-linq/query$': '<rootDir>/packages/query/src',
  '^@ts-linq/cache$': '<rootDir>/packages/cache/src',
  '^@ts-linq/cache-memcached$': '<rootDir>/packages/cache-memcached/src',
  '^@ts-linq/cache-redis$': '<rootDir>/packages/cache-redis/src',
  '^@ts-linq/ast$': '<rootDir>/packages/ast/src',
  '^@ts-linq/metrics-safe$': '<rootDir>/packages/metrics-safe/src',
  '^@ts-linq/migrations$': '<rootDir>/packages/migrations/src',
  '^@ts-linq/concurrency$': '<rootDir>/packages/concurrency/src',
  '^@ts-linq/config$': '<rootDir>/packages/config/src',
  '^@ts-linq/pagination$': '<rootDir>/packages/pagination/src',
  '^@ts-linq/plugin-audit$': '<rootDir>/packages/plugin-audit/src',
  '^@ts-linq/plugin-multi-tenant$': '<rootDir>/packages/plugin-multi-tenant/src',
  '^@ts-linq/plugin-soft-delete$': '<rootDir>/packages/plugin-soft-delete/src',
  '^@ts-linq/sql-visitor/internal$': '<rootDir>/packages/sql-visitor/src/internal',
  '^@ts-linq/sql-visitor$': '<rootDir>/packages/sql-visitor/src',
  '^@ts-linq/telemetry$': '<rootDir>/packages/telemetry/src',
  '^@ts-linq/provider-postgres$': '<rootDir>/packages/provider-postgres/src',
  '^@ts-linq/provider-mysql$': '<rootDir>/packages/provider-mysql/src',
  '^@ts-linq/provider-mssql$': '<rootDir>/packages/provider-mssql/src',
  '^@ts-linq/dialect-postgres$': '<rootDir>/packages/dialect-postgres/src',
  '^@ts-linq/dialect-mysql$': '<rootDir>/packages/dialect-mysql/src',
  '^@ts-linq/dialect-mssql$': '<rootDir>/packages/dialect-mssql/src',
  '^@ts-linq/testkits$': '<rootDir>/packages/testkits/src',
  '^@ts-linq/composite-sql-logger$': '<rootDir>/packages/composite-sql-logger/src',
  '^@ts-linq/prometheus-sql-logger$': '<rootDir>/packages/prometheus-sql-logger/src',
  '^@ts-linq/open-telemetry-sql-logger$': '<rootDir>/packages/open-telemetry-sql-logger/src',
  '^@ts-linq/integration-nestjs$': '<rootDir>/packages/integration-nestjs/src'
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
      '^@ts-linq/orm/internal$': '<rootDir>/../orm/src/internal',
      '^@ts-linq/query/internal$': '<rootDir>/../query/src/internal',
      '^@ts-linq/sql-visitor/internal$': '<rootDir>/../sql-visitor/src/internal',
      '^@ts-linq/(.*)$': '<rootDir>/../$1/src'
    },
    collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/index.ts'],
    coveragePathIgnorePatterns: ['/node_modules/', '/dist/'],
    ...overrides
  };
}

module.exports = {
  createJestConfig,
  createPackageJestConfig,
  tsLinqModuleNameMapper,
  tsLinqTsJestConfig
};
