const base = require('./jest.config.js');

module.exports = {
  ...base,
  forceExit: true,
  testPathIgnorePatterns: [
    ...((base && base.testPathIgnorePatterns) || []),
    '/packages/integration-tests/',
    '/packages/e2e-tests/',
    '/packages/orm/tests/integration/',
    '\\.integration\\.test\\.ts$'
  ]
};


