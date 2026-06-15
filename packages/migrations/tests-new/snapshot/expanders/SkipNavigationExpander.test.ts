import { describe, expect, it } from '@jest/globals';

import { SkipNavigationExpander } from '../../../src/snapshot/expanders/model/SkipNavigationExpander';
import type { ModelTableSnapshot } from '../../../src/snapshot/model-snapshot.types';
import { entity, modelCtx } from './support';

describe('SkipNavigationExpander', () => {
  const expander = new SkipNavigationExpander();

  it('emits a synthesized join table with composite PK', () => {
    const post = entity({
      tableName: 'posts',
      skipNavigations: [
        {
          isSynthesized: true,
          joinTableName: 'post_tags',
          leftForeignKey: 'postId',
          rightForeignKey: 'tagId'
        }
      ]
    } as never);

    const ctx = modelCtx(post);
    expander.expand(ctx);

    const joinTable = ctx.tables.get('post_tags');
    expect(joinTable).toBeDefined();
    expect(joinTable!.primaryKeys.sort()).toEqual(['postId', 'tagId']);
    expect(joinTable!.columns.every((c) => c.isPrimaryKey)).toBe(true);
  });

  it('skips non-synthesized navigations and dedupes by join-table name', () => {
    const tables = new Map<string, ModelTableSnapshot>([
      ['post_tags', { name: 'post_tags', columns: [], primaryKeys: [], indexes: [] }]
    ]);
    const post = entity({
      tableName: 'posts',
      skipNavigations: [
        {
          isSynthesized: false,
          joinTableName: 'explicit',
          leftForeignKey: 'a',
          rightForeignKey: 'b'
        },
        {
          isSynthesized: true,
          joinTableName: 'post_tags',
          leftForeignKey: 'postId',
          rightForeignKey: 'tagId'
        }
      ]
    } as never);

    const ctx = modelCtx(post, { tables });
    expander.expand(ctx);

    expect(ctx.tables.has('explicit')).toBe(false); // non-synthesized ignored
    // Existing entry preserved (deduped, not overwritten with empty columns).
    expect(ctx.tables.get('post_tags')!.columns).toEqual([]);
  });
});
