import 'reflect-metadata';

// Global test setup
beforeEach(() => {
  // Clear any existing metadata before each test
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const MetadataStorage = require('../src/metadata/MetadataStorage').MetadataStorage;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  MetadataStorage.getInstance().clear();
});

afterAll(async () => {
  // Flush pending microtasks
  await new Promise((r) => setImmediate(r));
  // Debug active handles if any remain
  const getActive = (process as any)._getActiveHandles?.bind(process);
  const getReqs = (process as any)._getActiveRequests?.bind(process);
  if (getActive) {
    const handles = getActive();
    if (handles && handles.length > 0) {
      // eslint-disable-next-line no-console
      console.warn('Active handles after tests:', handles.map((h: any) => h?.constructor?.name ?? typeof h));
    }
  }
  if (getReqs) {
    const reqs = getReqs();
    if (reqs && reqs.length > 0) {
      // eslint-disable-next-line no-console
      console.warn('Active requests after tests:', reqs.map((r: any) => r?.constructor?.name ?? typeof r));
    }
  }
});
