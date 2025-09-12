import 'reflect-metadata';

// Global test setup
beforeEach(() => {
  // Clear any existing metadata before each test
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const MetadataStorage = require('../src/metadata/MetadataStorage').MetadataStorage;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  MetadataStorage.getInstance().clear();
});
