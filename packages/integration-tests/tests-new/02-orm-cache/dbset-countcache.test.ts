describe('DbSet + CountCache Integration', () => {
  it.todo('should cache count() with predicate');
  it.todo('should use different cache keys for different predicates');
  it.todo('should invalidate count cache on entity insert');
  it.todo('should invalidate count cache on entity delete');
  it.todo('should NOT invalidate count cache on entity UPDATE (count unchanged)');
  it.todo('should support TTL expiration for count cache');
  it.todo('should evict LRU entries when count cache full');
  it.todo('should clear count cache independently');
});


