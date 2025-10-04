import { MssqlIndexBuilder } from '../src';

test('INDEX: with WHERE', () => {
  const sql = new MssqlIndexBuilder().buildCreateIndexSql('Users', {
    name: 'idx_users_active', columns: ['active'], unique: false, where: 'active = 1'
  });
  expect(sql).toContain('CREATE INDEX idx_users_active ON Users (active) WHERE active = 1');
});

test('INDEX: with INCLUDE and ORDERS', () => {
  const sql = new MssqlIndexBuilder().buildCreateIndexSql('Users', {
    name: 'idx_users_name', columns: ['lastName','firstName'], unique: true, include: ['age'], orders: { lastName: 'ASC', firstName: 'DESC' }
  });
  expect(sql).toContain('CREATE UNIQUE INDEX idx_users_name ON Users (lastName ASC, firstName DESC) INCLUDE (age)');
});


