/**
 * Integration tests for P0-11 Global Query Filters.
 *
 * These tests use `hasQueryFilterCompiled` directly (the compiled form that the transformer
 * produces) to verify the full runtime pipeline independently of the compile-time transformer.
 * Transformer behaviour is covered by unit tests in @ts-linq/transformer.
 */
import type { ExpressionNode } from '@ts-linq/ast';
import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';
import { DbContext, ModelBuilder } from '@ts-linq/orm';
import { TestProvider } from '@ts-linq/testkits';

// ─── Entities ────────────────────────────────────────────────────────────────

@Entity({ name: 'gqf_posts' })
class GqfPost {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  title!: string;

  @Column({ name: 'is_deleted', defaultValue: false })
  isDeleted!: boolean;

  @Column({ name: 'tenant_id' })
  tenantId!: string;
}

// Precompiled AST fragments — mirrors what the transformer would produce for:
//   p => !p.isDeleted       →  NotNode(PropertyNode('isDeleted'))
//   p => p.tenantId === tid →  BinaryNode(PropertyNode('tenantId'), ParameterRefNode(0))
const notDeletedAst: ExpressionNode = {
  type: 'not',
  operand: { type: 'property', name: 'isDeleted' }
};

const tenantAst: ExpressionNode = {
  type: 'binary',
  operator: '===',
  left: { type: 'property', name: 'tenantId' },
  right: { type: 'parameterRef', index: 0 }
};

// ─── Contexts ─────────────────────────────────────────────────────────────────

class SdFilterContext extends DbContext {
  constructor(provider: TestProvider) {
    super({ provider });
  }

  protected override onModelCreating(mb: ModelBuilder): void {
    mb.entity(GqfPost, (b) => {
      // Equivalent to: b.hasQueryFilter(p => !p.isDeleted)
      b.hasQueryFilterCompiled({ ast: notDeletedAst, parameters: [] });
    });
  }
}

/** Store tenant id in a static so onModelCreating (called from super()) can capture it. */
let _multiContextTenantId = '';

class MultiFilterContext extends DbContext {
  constructor(provider: TestProvider, tenantId: string) {
    _multiContextTenantId = tenantId;
    super({ provider });
  }

  protected override onModelCreating(mb: ModelBuilder): void {
    const tid = _multiContextTenantId;
    mb.entity(GqfPost, (b) => {
      // Equivalent to: b.hasQueryFilter('softDelete', p => !p.isDeleted)
      b.hasQueryFilterCompiled('softDelete', { ast: notDeletedAst, parameters: [] });
      // Equivalent to: b.hasQueryFilter('tenant', p => p.tenantId === tid)
      b.hasQueryFilterCompiled('tenant', { ast: tenantAst, parameters: [tid] });
    });
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('P0-11 Global Query Filters — model-level hasQueryFilter', () => {
  let provider: TestProvider;

  beforeEach(async () => {
    provider = new TestProvider(':memory:');

    // Ensure schema is created
    const seed = new SdFilterContext(provider);
    await seed.ensureCreated();
    await seed.dispose();

    // Seed data bypassing context-level filters
    await provider.insertMany(
      [
        { title: 'AliveA', isDeleted: false, tenantId: 'A' },
        { title: 'DeletedA', isDeleted: true, tenantId: 'A' },
        { title: 'AliveB', isDeleted: false, tenantId: 'B' },
        { title: 'DeletedB', isDeleted: true, tenantId: 'B' }
      ],
      GqfPost
    );
  });

  afterEach(async () => {
    await provider.disconnect();
  });

  // ── Unnamed single filter ──────────────────────────────────────────────────

  it('unnamed hasQueryFilter excludes soft-deleted rows', async () => {
    const ctx = new SdFilterContext(provider);
    const posts = await ctx.set(GqfPost).toArray();

    expect(posts).toHaveLength(2);
    expect(posts.every((p) => !p.isDeleted)).toBe(true);
    await ctx.dispose();
  });

  it('ignoreQueryFilters() returns all rows including soft-deleted', async () => {
    const ctx = new SdFilterContext(provider);
    const posts = await ctx.set(GqfPost).ignoreQueryFilters().toArray();

    expect(posts).toHaveLength(4);
    await ctx.dispose();
  });

  // ── Named multi-filter ─────────────────────────────────────────────────────

  it('named filters compose: softDelete + tenant each applied', async () => {
    const ctx = new MultiFilterContext(provider, 'A');
    const posts = await ctx.set(GqfPost).toArray();

    // Only AliveA should match: not deleted AND tenant A
    expect(posts).toHaveLength(1);
    expect(posts[0].title).toBe('AliveA');
    await ctx.dispose();
  });

  it('ignoreQueryFilters("softDelete") disables soft-delete, keeps tenant filter', async () => {
    const ctx = new MultiFilterContext(provider, 'A');
    const posts = await ctx.set(GqfPost).ignoreQueryFilters('softDelete').toArray();

    // Both tenant-A posts returned (alive + deleted)
    expect(posts).toHaveLength(2);
    expect(posts.every((p: GqfPost) => p.tenantId === 'A')).toBe(true);
    await ctx.dispose();
  });

  it('ignoreQueryFilters() (all) disables every filter and returns all rows', async () => {
    const ctx = new MultiFilterContext(provider, 'A');
    const posts = await ctx.set(GqfPost).ignoreQueryFilters().toArray();

    expect(posts).toHaveLength(4);
    await ctx.dispose();
  });
});
