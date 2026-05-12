module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/tests-old/'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          lib: ['ES2021', 'DOM'],
          baseUrl: '.',
          paths: {
            '@ts-linq/orm': ['packages/orm/src'],
            '@ts-linq/migrations': ['packages/migrations/src'],
            '@ts-linq/dialect-postgres': ['packages/dialect-postgres/src'],
            '@ts-linq/dialect-mysql': ['packages/dialect-mysql/src'],
            '@ts-linq/dialect-mssql': ['packages/dialect-mssql/src'],
            '@ts-linq/provider-postgres': ['packages/provider-postgres/src'],
            '@ts-linq/provider-mysql': ['packages/provider-mysql/src'],
            '@ts-linq/provider-mssql': ['packages/provider-mssql/src']
          }
        }
      }
    ]
  },
  moduleNameMapper: {
    '^@ts-linq/types$': '<rootDir>/packages/types/src',
    '^@ts-linq/metadata$': '<rootDir>/packages/metadata/src',
    '^@ts-linq/core$': '<rootDir>/packages/core/src',
    '^@ts-linq/orm$': '<rootDir>/packages/orm/src',
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
  },
  collectCoverageFrom: [
    'packages/**/src/**/*.ts',
    '!packages/**/src/**/*.d.ts',
    '!packages/**/tests/**',
    '!packages/**/dist/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 10000
};
