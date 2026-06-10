import { getProp, setProp } from '../../src/loading/support/EntityRecord';

describe('EntityRecord — audited dynamic-access boundary', () => {
  it('reads the same values the previous Record punning did', () => {
    const entity = { id: 7, name: 'Alice', authorId: null as number | null };
    expect(getProp(entity, 'id')).toBe(7);
    expect(getProp(entity, 'name')).toBe('Alice');
    expect(getProp(entity, 'authorId')).toBeNull();
    expect(getProp(entity, 'missing')).toBeUndefined();
  });

  it('writes values back onto the entity', () => {
    const entity: Record<string, unknown> = { id: 1 };
    setProp(entity, 'posts', [{ id: 10 }]);
    setProp(entity, 'author', { id: 99 });
    expect(entity.posts).toEqual([{ id: 10 }]);
    expect(entity.author).toEqual({ id: 99 });
  });

  it('round-trips an arbitrary key', () => {
    const entity = {};
    setProp(entity, 'dynamic', 42);
    expect(getProp(entity, 'dynamic')).toBe(42);
  });
});
