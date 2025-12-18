module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests-new'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@ts-linq/(.*)$': '<rootDir>/../$1/src'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts'
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ]
};
