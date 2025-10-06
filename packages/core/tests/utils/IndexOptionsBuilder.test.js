'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const IndexOptionsBuilder_1 = require('../../src/utils/IndexOptionsBuilder');
describe('IndexOptionsBuilder', () => {
  test('builds minimal index with columns', () => {
    const opts = new IndexOptionsBuilder_1.IndexOptionsBuilder('idx_min').onColumns(['id']).build();
    expect(opts).toEqual({ name: 'idx_min', columns: ['id'], unique: false });
  });
  test('supports unique and where', () => {
    const opts = new IndexOptionsBuilder_1.IndexOptionsBuilder('idx_unique_where')
      .onColumns(['email'])
      .unique()
      .where('email IS NOT NULL')
      .build();
    expect(opts.unique).toBe(true);
    expect(opts.where).toBe('email IS NOT NULL');
  });
  test('merges orderBy, expressions, collations and nulls', () => {
    const opts = new IndexOptionsBuilder_1.IndexOptionsBuilder('idx_complex')
      .onColumns(['email', 'createdAt'])
      .orderBy({ email: 'ASC' })
      .orderBy({ createdAt: 'DESC' })
      .expressions(['LOWER(email)'])
      .collations({ email: 'nocase' })
      .nulls({ createdAt: 'LAST' })
      .build();
    expect(opts.orders).toEqual({ email: 'ASC', createdAt: 'DESC' });
    expect(opts.expressions).toEqual(['LOWER(email)']);
    expect(opts.collations).toEqual({ email: 'nocase' });
    expect(opts.nulls).toEqual({ createdAt: 'LAST' });
  });
  test('supports Postgres-specific options', () => {
    const opts = new IndexOptionsBuilder_1.IndexOptionsBuilder('idx_pg')
      .onColumns(['title'])
      .using('gin')
      .concurrently(true)
      .withParams({ fastupdate: 'on', fillfactor: 90 })
      .build();
    expect(opts.using).toBe('gin');
    expect(opts.concurrently).toBe(true);
    expect(opts.withParams).toEqual({ fastupdate: 'on', fillfactor: 90 });
  });
  test('supports MySQL visibility', () => {
    const opts = new IndexOptionsBuilder_1.IndexOptionsBuilder('idx_mysql')
      .onColumns(['path'])
      .mysqlVisibility('INVISIBLE')
      .build();
    expect(opts.mysqlVisibility).toBe('INVISIBLE');
  });
  test('supports MSSQL include columns', () => {
    const opts = new IndexOptionsBuilder_1.IndexOptionsBuilder('idx_mssql')
      .onColumns(['userId'])
      .include(['email', 'createdAt'])
      .build();
    expect(opts.include).toEqual(['email', 'createdAt']);
  });
  test('throws when name is empty', () => {
    expect(() =>
      new IndexOptionsBuilder_1.IndexOptionsBuilder(' ').onColumns(['a']).build()
    ).toThrow('Index name must be provided');
  });
  test('throws when no columns provided', () => {
    expect(() => new IndexOptionsBuilder_1.IndexOptionsBuilder('idx').build()).toThrow(
      'Index must reference at least one column'
    );
  });
});
//# sourceMappingURL=IndexOptionsBuilder.test.js.map
