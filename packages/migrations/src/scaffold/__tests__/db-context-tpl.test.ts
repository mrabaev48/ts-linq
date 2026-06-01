import type { DatabaseTableModel } from '@ts-linq/types';

import { renderDbContextTemplate } from '../templates/db-context.tpl';

const opts = { useDatabaseNames: false, pluralize: false };

function makeTable(name: string): DatabaseTableModel {
  return { name, columns: [], primaryKeys: [], foreignKeys: [], indexes: [] };
}

describe('renderDbContextTemplate', () => {
  it('generates DbContext class with DbSet properties', () => {
    const tables = [makeTable('orders'), makeTable('users')];
    const result = renderDbContextTemplate(tables, 'AppContext', opts);
    expect(result).toContain('export class AppContext extends DbContext {');
    expect(result).toContain('DbSet<Order>');
    expect(result).toContain('DbSet<User>');
    expect(result).toContain("import { Order } from './Order'");
    expect(result).toContain("import { User } from './User'");
  });

  it('uses custom context name', () => {
    const tables = [makeTable('products')];
    const result = renderDbContextTemplate(tables, 'ShopContext', opts);
    expect(result).toContain('export class ShopContext extends DbContext {');
  });

  it('pluralizes DbSet property names', () => {
    const tables = [makeTable('order'), makeTable('category')];
    const result = renderDbContextTemplate(tables, 'AppContext', opts);
    expect(result).toContain('public orders!:');
    expect(result).toContain('public categories!:');
  });
});
