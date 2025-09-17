import 'reflect-metadata';

// Global test setup
beforeEach(() => {
  // Clear any existing metadata before each test
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const MetadataStorage = require('../src/metadata/MetadataStorage').MetadataStorage;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  MetadataStorage.getInstance().clear();
});

beforeAll(async () => {
  try {
    const mod = await import('./db/setup-containers');
    await mod.startDbContainers();
  } catch {
    // ignore if testcontainers not installed or RUN_DB_TESTS != 1
  }
});

afterAll(async () => {
  try {
    const mod = await import('./db/setup-containers');
    await mod.stopDbContainers();
  } catch {
    // ignore
  }
});
