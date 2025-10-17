module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.e2e.test.ts'],
  moduleNameMapper: {
    '^@ts-linq/core$': '<rootDir>/../core/src',
    '^@ts-linq/testkits$': '<rootDir>/../testkits/src',
    '^@ts-linq/provider-sqlite$': '<rootDir>/../provider-sqlite/src',
    '^@ts-linq/provider-postgres$': '<rootDir>/../provider-postgres/src',
    '^@ts-linq/provider-mysql$': '<rootDir>/../provider-mysql/src',
    '^@ts-linq/provider-mssql$': '<rootDir>/../provider-mssql/src'
  },
  testTimeout: 30000,
  detectOpenHandles: true,
  forceExit: true
};
