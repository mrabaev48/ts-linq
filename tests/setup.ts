import 'reflect-metadata';

// Global test setup
beforeEach(() => {
  // Clear any existing metadata before each test
  const MetadataStorage = require('../src/metadata/MetadataStorage').MetadataStorage;
  MetadataStorage.getInstance().clear();
});
