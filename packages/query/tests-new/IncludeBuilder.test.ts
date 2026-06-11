/**
 * Unit tests for {@link IncludeBuilder} — the include/thenInclude proxy + validation + path-walk
 * logic extracted from `Queryable` (refactor query/task-1).
 */
import { MetadataStorage } from '@ts-linq/metadata';

import { IncludeResolutionError } from '../src/errors';
import type { IncludeSubquery } from '../src/include/IncludeSubquery';
import { IncludeBuilder } from '../src/IncludeBuilder';

class IbComment {
  id!: number;
}
class IbPost {
  id!: number;
  comments!: IbComment[];
}
class IbBlog {
  id!: number;
  posts!: IbPost[];
}

beforeAll(() => {
  MetadataStorage.addEntity(IbBlog, 'ib_blogs');
  MetadataStorage.addRelationship(IbBlog, {
    propertyName: 'posts',
    type: 'one-to-many',
    targetEntity: IbPost
  });
  MetadataStorage.addEntity(IbPost, 'ib_posts');
  MetadataStorage.addRelationship(IbPost, {
    propertyName: 'comments',
    type: 'one-to-many',
    targetEntity: IbComment
  });
  MetadataStorage.addEntity(IbComment, 'ib_comments');
});

describe('IncludeBuilder.resolveInclude', () => {
  const builder = new IncludeBuilder<IbBlog>(IbBlog);

  it('resolves a string key to a simple include', () => {
    expect(builder.resolveInclude('posts')).toEqual({ kind: 'simple', key: 'posts' });
  });

  it('resolves a plain lambda to a simple include', () => {
    expect(builder.resolveInclude((b: IbBlog) => b.posts)).toEqual({
      kind: 'simple',
      key: 'posts'
    });
  });

  it('resolves a filtered lambda to a filtered include carrying the subquery', () => {
    const decision = builder.resolveInclude((b: { posts: IncludeSubquery<unknown> }) =>
      b.posts.take(5)
    );
    expect(decision.kind).toBe('filtered');
    expect(decision.key).toBe('posts');
    if (decision.kind === 'filtered') {
      expect(decision.subquery.isFiltered).toBe(true);
    }
  });

  it('throws IncludeResolutionError for an unknown relationship', () => {
    expect(() => builder.resolveInclude('unknownRel')).toThrow(IncludeResolutionError);
  });
});

describe('IncludeBuilder.resolveThenInclude', () => {
  const builder = new IncludeBuilder<IbBlog>(IbBlog);

  it('builds the full nested path when valid', () => {
    expect(builder.resolveThenInclude('posts', (p: IbPost) => p.comments)).toBe('posts.comments');
  });

  it('throws IncludeResolutionError when the nested key is invalid', () => {
    expect(() =>
      builder.resolveThenInclude('posts', (p: { missing: unknown }) => p.missing)
    ).toThrow(IncludeResolutionError);
  });
});
