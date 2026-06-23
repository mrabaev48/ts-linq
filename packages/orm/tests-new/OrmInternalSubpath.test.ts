// Verifies the published `@ts-linq/orm/internal` subpath specifier resolves (orm/task-6).
// At runtime this is backed by the package.json `exports` "./internal" mapping (cjs + esm +
// types); under the test toolchain it resolves through the jest-config moduleNameMapper. Importing
// via the package specifier (not a relative path) is what exercises that boundary.
import {
  BatchExecutor,
  HiLoValueGenerator,
  IdentityMap,
  InterceptorRegistry
} from '@ts-linq/orm/internal';

describe('@ts-linq/orm/internal subpath', () => {
  it('resolves the opt-in internal subpath and exposes the moved collaborators', () => {
    expect(BatchExecutor).toBeDefined();
    expect(IdentityMap).toBeDefined();
    expect(InterceptorRegistry).toBeDefined();
    expect(HiLoValueGenerator).toBeDefined();
  });
});
