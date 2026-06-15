import { describe, expect, it } from '@jest/globals';
import type { ShadowPropertyMetadata } from '@ts-linq/types';

import { ShadowPropertyExpander } from '../../../src/snapshot/expanders/schema/ShadowPropertyExpander';
import { entity, schemaCtx } from './support';

describe('ShadowPropertyExpander', () => {
  const expander = new ShadowPropertyExpander();

  it('appends shadow properties as regular columns', () => {
    const shadow = new Map<string, ShadowPropertyMetadata>([
      [
        'createdAt',
        {
          propertyName: 'createdAt',
          columnName: 'created_at',
          type: 'DATETIME',
          nullable: false
        } as unknown as ShadowPropertyMetadata
      ]
    ]);
    const user = entity({ tableName: 'users', shadowProperties: shadow } as never);

    const ctx = schemaCtx(user, { columns: [] });
    expander.expand(ctx);

    const sp = ctx.columns.find((c) => c.name === 'created_at');
    expect(sp).toBeDefined();
    expect(sp!.type).toBe('TEXT'); // DATETIME → TEXT (portable)
    expect(sp!.nullable).toBe(false);
  });

  it('is a no-op when there are no shadow properties', () => {
    const ctx = schemaCtx(entity({ tableName: 'users' }), { columns: [] });
    expander.expand(ctx);
    expect(ctx.columns).toEqual([]);
  });
});
