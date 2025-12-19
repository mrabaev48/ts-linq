module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.e2e.test.ts'],
  moduleNameMapper: {
    '^@ts-linq/types$': '<rootDir>/../types/src',
    '^@ts-linq/core$': '<rootDir>/../core/src',
    '^@ts-linq/orm$': '<rootDir>/../orm/src',
    '^@ts-linq/metadata$': '<rootDir>/../metadata/src',
    '^@ts-linq/testkits$': '<rootDir>/../testkits/src',
    '^@ts-linq/dialect-sqlite$': '<rootDir>/../dialect-sqlite/src',
    '^@ts-linq/dialect-postgres$': '<rootDir>/../dialect-postgres/src',
    '^@ts-linq/dialect-mysql$': '<rootDir>/../dialect-mysql/src',
    '^@ts-linq/dialect-mssql$': '<rootDir>/../dialect-mssql/src',
    '^@ts-linq/provider-sqlite$': '<rootDir>/../provider-sqlite/src',
    '^@ts-linq/provider-postgres$': '<rootDir>/../provider-postgres/src',
    '^@ts-linq/provider-mysql$': '<rootDir>/../provider-mysql/src',
    '^@ts-linq/provider-mssql$': '<rootDir>/../provider-mssql/src',
    '^@ts-linq/query$': '<rootDir>/../query/src',
    '^@ts-linq/migrations$': '<rootDir>/../migrations/src',
    '^@ts-linq/ast$': '<rootDir>/../ast/src',
    '^@ts-linq/config$': '<rootDir>/../config/src',
    '^@ts-linq/metrics-safe$': '<rootDir>/../metrics-safe/src'
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json'
    }]
  },
  testTimeout: 30000,
  detectOpenHandles: true,
  forceExit: true
};
