import 'reflect-metadata';

import { createMetadataRegistry } from '@ts-linq/metadata';

import { EntityTypeBuilder } from '../src/builders/EntityTypeBuilder';

class Post {
  id!: number;
  isDeleted!: boolean;
  tenantId!: string;
  title!: string;
}

describe('EntityTypeBuilder — hasQueryFilter', () => {
  it('hasQueryFilter runtime implementation throws when called with a non-arrow argument', () => {
    const builder = new EntityTypeBuilder(Post);
    // Pass a named function (not arrow) — transformer only handles arrow functions
    // The transformer reports a diagnostic and leaves the call unchanged, so it reaches the stub
    function namedPredicate(p: Post): boolean {
      return !p.isDeleted;
    }
    expect(() => builder.hasQueryFilter(namedPredicate)).toThrow(
      /compile-time transformer is required/
    );
  });

  it('hasQueryFilterCompiled stores an unnamed (_default) filter via _getQueryFilters', () => {
    const builder = new EntityTypeBuilder(Post);
    const fakeAst = { type: 'Literal', value: true };
    builder.hasQueryFilterCompiled({ ast: fakeAst, parameters: [] });

    const filters = builder._getQueryFilters();
    expect(filters).toHaveLength(1);
    expect(filters[0].name).toBe('_default');
    expect(filters[0].ast).toBe(fakeAst);
  });

  it('hasQueryFilterCompiled stores a named filter', () => {
    const builder = new EntityTypeBuilder(Post);
    const fakeAst = { type: 'BinaryExpression', operator: '=' };
    builder.hasQueryFilterCompiled('tenant', { ast: fakeAst, parameters: ['acme'] });

    const filters = builder._getQueryFilters();
    expect(filters).toHaveLength(1);
    expect(filters[0].name).toBe('tenant');
    expect(filters[0].parameters).toEqual(['acme']);
  });

  it('hasQueryFilterCompiled composes multiple named filters', () => {
    const builder = new EntityTypeBuilder(Post);
    builder.hasQueryFilterCompiled('softDelete', {
      ast: { type: 'Literal', value: false },
      parameters: [false]
    });
    builder.hasQueryFilterCompiled('tenant', {
      ast: { type: 'Literal', value: 'x' },
      parameters: ['x']
    });

    const filters = builder._getQueryFilters();
    expect(filters).toHaveLength(2);
    expect(filters.map((f) => f.name)).toEqual(['softDelete', 'tenant']);
  });

  it('hasQueryFilterCompiled replaces existing filter with same name', () => {
    const builder = new EntityTypeBuilder(Post);
    const ast1 = { type: 'A' };
    const ast2 = { type: 'B' };
    builder.hasQueryFilterCompiled('sd', { ast: ast1, parameters: [] });
    builder.hasQueryFilterCompiled('sd', { ast: ast2, parameters: [] });

    const filters = builder._getQueryFilters();
    expect(filters).toHaveLength(1);
    expect(filters[0].ast).toBe(ast2);
  });

  it('_applyToRegistry does NOT write queryFilters to registry', () => {
    const builder = new EntityTypeBuilder(Post);
    builder.hasQueryFilterCompiled({ ast: { type: 'X' }, parameters: [] });

    const registry = createMetadataRegistry();
    registry.addEntity(Post, 'posts');
    builder._applyToRegistry(registry);

    const meta = registry.getEntity(Post);
    // Filters are no longer stored globally — they live per-DbContext
    expect(meta?.queryFilters ?? []).toHaveLength(0);
  });
});
