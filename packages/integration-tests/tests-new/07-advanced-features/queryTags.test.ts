/**
 * Integration tests — Query Tags (P2-41).
 *
 * Verifies:
 * - tagWith() prepends a SQL comment to the emitted statement
 * - tagWithCallSite() appends a "File: <path>:<line>" tag
 * - Multiple tags appear in call order
 * - Tags are preserved through clone()
 * - Sanitization rejects invalid tags at call time
 * - getTags() returns the accumulated tag list
 */
import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';
import { DbContext, DbContextOptionsBuilder } from '@ts-linq/orm';
import { QueryTagError } from '@ts-linq/query';
import { TestProvider } from '@ts-linq/testkits';
import type { SqlLogger } from '@ts-linq/types';

// ── Entity fixtures ───────────────────────────────────────────────────────────

@Entity({ name: 'qt_orders' })
class QtOrder {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  status!: string;
}

// ── Context ───────────────────────────────────────────────────────────────────

class QtContext extends DbContext {
  orders = this.defineSet(QtOrder);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCtx(): { ctx: QtContext; capturedSqls: string[] } {
  const capturedSqls: string[] = [];

  const logger: SqlLogger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    queryStart: (info) => {
      capturedSqls.push(info.sql);
    }
  };

  const provider = new TestProvider({ logger });
  const ctx = new QtContext(new DbContextOptionsBuilder({ provider }).build());
  return { ctx, capturedSqls };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Query Tags — integration (P2-41)', () => {
  let ctx: QtContext;
  let capturedSqls: string[];

  beforeEach(async () => {
    ({ ctx, capturedSqls } = makeCtx());
    await ctx.ensureCreated();
    capturedSqls.length = 0; // clear DDL queries from ensureCreated
  });

  afterEach(async () => {
    if (ctx) await ctx.dispose();
  });

  function lastSql(): string {
    return capturedSqls[capturedSqls.length - 1] ?? '';
  }

  it('tagWith() emits a leading -- comment in the SQL', async () => {
    await ctx.orders.tagWith('dashboard-top-orders').toArray();
    expect(lastSql()).toMatch(/^-- dashboard-top-orders\n/);
  });

  it('multiple tagWith() calls accumulate in call order', async () => {
    await ctx.orders.tagWith('first').tagWith('second').tagWith('third').toArray();
    expect(lastSql()).toMatch(/^-- first\n-- second\n-- third\n/);
  });

  it('tagWithCallSite() appends a "File: ..." tag with a line number', async () => {
    await ctx.orders.tagWithCallSite().toArray();
    expect(lastSql()).toMatch(/^-- File: .+:\d+\n/);
  });

  it('tagWith() and tagWithCallSite() can be combined', async () => {
    await ctx.orders.tagWith('my-query').tagWithCallSite().toArray();
    expect(lastSql()).toMatch(/^-- my-query\n-- File: /);
  });

  it('getTags() returns the current tag list', () => {
    const query = ctx.orders.tagWith('tag-a').tagWith('tag-b');
    expect(query.getTags()).toEqual(['tag-a', 'tag-b']);
  });

  it('getTags() returns an empty array when no tags are set', () => {
    expect(ctx.orders.getTags()).toEqual([]);
  });

  it('tags do not affect sibling query chains (immutable clone)', async () => {
    const base = ctx.orders;
    const tagged = base.tagWith('isolated');

    capturedSqls.length = 0;
    await tagged.toArray();
    const taggedSql = capturedSqls[capturedSqls.length - 1] ?? '';

    capturedSqls.length = 0;
    await base.toArray();
    const baseSql = capturedSqls[capturedSqls.length - 1] ?? '';

    expect(taggedSql).toMatch(/^-- isolated\n/);
    expect(baseSql).not.toMatch(/^--/);
  });

  it('tagWith() throws QueryTagError for newline injection at call time', () => {
    expect(() => ctx.orders.tagWith('bad\ntag')).toThrow(QueryTagError);
  });

  it('tagWith() throws QueryTagError for comment-break injection at call time', () => {
    expect(() => ctx.orders.tagWith('bad */ tag')).toThrow(QueryTagError);
  });

  it('SQL after the tag prefix is valid SELECT syntax', async () => {
    await ctx.orders.tagWith('smoke-test').toArray();
    const sql = capturedSqls[capturedSqls.length - 1] ?? '';
    const withoutTags = sql.replace(/^(--[^\n]*\n)+/, '');
    expect(withoutTags.trim().toUpperCase()).toMatch(/^SELECT/);
  });
});
