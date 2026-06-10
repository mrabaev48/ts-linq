import type { EntityRef, RelationshipMetadata } from '@ts-linq/types';

import { EntityGrouper } from '../../src/loading/support/EntityGrouper';
import { ForeignKeyConvention } from '../../src/loading/support/ForeignKeyConvention';
import {
  asLoadable,
  type LoadableRelationship
} from '../../src/loading/support/LoadableRelationship';
import { TargetEntityResolver } from '../../src/loading/support/TargetEntityResolver';

class User {}
class Post {}

describe('ForeignKeyConvention', () => {
  const convention = new ForeignKeyConvention();

  it('derives camelCase(name) + "Id"', () => {
    expect(convention.defaultFor(User)).toBe('userId');
    expect(convention.defaultFor(Post)).toBe('postId');
  });

  it('falls back to "idId" for an unnamed constructor', () => {
    const Anonymous = (() => class {})();
    Object.defineProperty(Anonymous, 'name', { value: '' });
    expect(convention.defaultFor(Anonymous)).toBe('idId');
  });
});

describe('TargetEntityResolver', () => {
  const resolver = new TargetEntityResolver();

  it('returns a constructor target unchanged', () => {
    expect(resolver.resolve(User as unknown as EntityRef)).toBe(User);
  });

  it('unwraps a lazy thunk target', () => {
    expect(resolver.resolve((() => Post) as unknown as EntityRef)).toBe(Post);
  });
});

describe('EntityGrouper', () => {
  const grouper = new EntityGrouper();

  it('groups rows by key into a multimap', () => {
    const rows = [
      { fk: 1, v: 'a' },
      { fk: 1, v: 'b' },
      { fk: 2, v: 'c' }
    ];
    const grouped = grouper.groupByKey(rows, (r) => r.fk);
    expect(grouped.get(1)).toEqual([rows[0], rows[1]]);
    expect(grouped.get(2)).toEqual([rows[2]]);
  });

  it('indexes rows by key (last write wins)', () => {
    const rows = [
      { id: 1, v: 'a' },
      { id: 1, v: 'b' }
    ];
    const index = grouper.indexByKey(rows, (r) => r.id);
    expect(index.get(1)).toEqual(rows[1]);
  });

  it('deduplicates while dropping null/undefined', () => {
    expect(grouper.uniqueDefined([1, 1, null, 2, undefined, 2])).toEqual([1, 2]);
  });
});

describe('asLoadable', () => {
  const base: RelationshipMetadata = {
    propertyName: 'author',
    type: 'many-to-one',
    targetEntity: User,
    foreignKey: 'authorId'
  };

  it('projects a constructor-targeted relationship', () => {
    const loadable = asLoadable(base);
    expect(loadable).not.toBeNull();
    expect(loadable?.targetEntity).toBe(User);
    expect(loadable?.foreignKey).toBe('authorId');
  });

  it('returns null for a string targetEntity (unresolvable)', () => {
    expect(asLoadable({ ...base, targetEntity: 'User' })).toBeNull();
  });

  it('returns null for an absent targetEntity', () => {
    expect(asLoadable({ ...base, targetEntity: undefined })).toBeNull();
  });

  it('normalizes a junction "through" object and ignores string form', () => {
    const m2m = asLoadable({
      ...base,
      type: 'many-to-many',
      through: { table: 'post_tags', sourceFk: 'postId', targetFk: 'tagId' }
    });
    expect(m2m?.through).toEqual({ table: 'post_tags', sourceFk: 'postId', targetFk: 'tagId' });
    expect(asLoadable({ ...base, through: 'post_tags' })?.through).toBeUndefined();
  });
});

describe('LoadableRelationship type contract', () => {
  it('narrows targetEntity to EntityRef (no string widening)', () => {
    const loadable = asLoadable({
      propertyName: 'author',
      type: 'many-to-one',
      targetEntity: User
    });
    if (loadable) {
      // targetEntity is a resolvable EntityRef, assignable as such…
      const ref: EntityRef = loadable.targetEntity;
      expect(ref).toBe(User);
    }
    // …and the contract does not permit a string target.
    const widened: LoadableRelationship = {
      propertyName: 'author',
      type: 'many-to-one',
      // @ts-expect-error string is not assignable to EntityRef — contract not widened
      targetEntity: 'User'
    };
    void widened;
  });
});
