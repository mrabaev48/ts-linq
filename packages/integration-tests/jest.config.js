const base = require('../../jest.config');

module.exports = {
  ...base,
  rootDir: '../../',
  roots: ['<rootDir>/packages/integration-tests/tests-new'],
  testTimeout: Math.max(base.testTimeout ?? 10000, 30000),
  testPathIgnorePatterns: ['/node_modules/', '/tests-old/'],
  testSequencer: '<rootDir>/packages/integration-tests/jest.sequencer.js'
};



