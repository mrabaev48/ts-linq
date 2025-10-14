import 'reflect-metadata';
import { CachePolicy } from '../../src/decorators/CachePolicy';

@CachePolicy({ ttl: 60, invalidateOn: ['Order'] })
class User {}

describe('CachePolicy decorator', () => {
  test('stores metadata with ttl and dependencies', () => {
    const meta = (Reflect as any).getOwnMetadata?.('orm:cachePolicy', User);
    expect(meta).toBeDefined();
    expect(meta.ttl).toBe(60);
    expect(meta.invalidateOn).toEqual(['Order']);
  });
});
