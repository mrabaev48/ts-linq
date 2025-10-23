module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  moduleNameMapper: {
    '^@ts-linq/types$': '<rootDir>/packages/types/src',
    '^@ts-linq/metadata$': '<rootDir>/packages/metadata/src',
    '^@ts-linq/core$': '<rootDir>/packages/core/src',
    '^@ts-linq/orm$': '<rootDir>/packages/orm/src',
    '^@ts-linq/query$': '<rootDir>/packages/query/src',
    '^@ts-linq/cache$': '<rootDir>/packages/cache/src',
    '^@ts-linq/ast$': '<rootDir>/packages/ast/src',
    '^@ts-linq/metrics-safe$': '<rootDir>/packages/metrics-safe/src',
    '^@ts-linq/provider-sqlite$': '<rootDir>/packages/provider-sqlite/src',
    '^@ts-linq/provider-postgres$': '<rootDir>/packages/provider-postgres/src',
    '^@ts-linq/provider-mysql$': '<rootDir>/packages/provider-mysql/src',
    '^@ts-linq/provider-mssql$': '<rootDir>/packages/provider-mssql/src',
    '^@ts-linq/dialect-sqlite$': '<rootDir>/packages/dialect-sqlite/src',
    '^@ts-linq/dialect-postgres$': '<rootDir>/packages/dialect-postgres/src',
    '^@ts-linq/dialect-mysql$': '<rootDir>/packages/dialect-mysql/src',
    '^@ts-linq/dialect-mssql$': '<rootDir>/packages/dialect-mssql/src',
    '^@ts-linq/testkits$': '<rootDir>/packages/testkits/src',
    '^@ts-linq/composite-sql-logger$': '<rootDir>/packages/composite-sql-logger/src',
    '^@ts-linq/prometheus-sql-logger$': '<rootDir>/packages/prometheus-sql-logger/src',
    '^@ts-linq/open-telemetry-sql-logger$': '<rootDir>/packages/open-telemetry-sql-logger/src'
  },
  collectCoverageFrom: [
    'packages/**/src/**/*.ts',
    '!packages/**/src/**/*.d.ts',
    '!packages/**/tests/**',
    '!packages/**/dist/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 10000,
  globals: {
    'ts-jest': {
      tsconfig: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true
      }
    }
  }
};
