import { emitGroup, emitJoin, emitOrder, emitWhere } from '@ts-linq/dialect-kit';
import type { QueryOptions, SqlParameter } from '@ts-linq/types';

// A trivial stub quoter so JOIN tests stay dialect-agnostic and assert on quoting placement only.
const stubQuote = (id: string): string => `<${id}>`;

describe('emitWhere', () => {
  it('returns empty string when there is no predicate', () => {
    const params: SqlParameter[] = [];
    expect(emitWhere(params, {})).toBe('');
    expect(params).toEqual([]);
  });

  it('emits a single predicate and collects its parameters', () => {
    const params: SqlParameter[] = [];
    const options: QueryOptions = { where: { condition: 'id = ?', parameters: [1] } };
    expect(emitWhere(params, options)).toBe(' WHERE id = ?');
    expect(params).toEqual([1]);
  });

  it('joins multiple predicates with AND, preserving parameter order', () => {
    const params: SqlParameter[] = [];
    const options: QueryOptions = {
      where: [
        { condition: 'id > ?', parameters: [10] },
        { condition: 'name LIKE ?', parameters: ['%test%'] }
      ]
    };
    expect(emitWhere(params, options)).toBe(' WHERE id > ? AND name LIKE ?');
    expect(params).toEqual([10, '%test%']);
  });
});

describe('emitJoin', () => {
  it('returns empty string when there are no joins', () => {
    expect(emitJoin({}, stubQuote)).toBe('');
  });

  it('renders a join using the injected quoter for the table name', () => {
    const options: QueryOptions = {
      joins: [{ type: 'INNER', table: 'orders', on: 'orders.user_id = test_table.id' }]
    };
    expect(emitJoin(options, stubQuote)).toBe(
      ' INNER JOIN <orders> ON orders.user_id = test_table.id'
    );
  });

  it('quotes structured onColumns through the injected quoter and honors the alias', () => {
    const options: QueryOptions = {
      joins: [
        {
          type: 'LEFT',
          table: 'orders',
          alias: 'o',
          onColumns: [
            {
              left: { table: 'o', column: 'user_id' },
              right: { table: 'test_table', column: 'id' }
            }
          ]
        }
      ]
    };
    expect(emitJoin(options, stubQuote)).toBe(
      ' LEFT JOIN <orders> AS o ON <o>.<user_id> = <test_table>.<id>'
    );
  });
});

describe('emitGroup', () => {
  it('returns empty string when there is no groupBy', () => {
    const params: SqlParameter[] = [];
    expect(emitGroup(params, {})).toBe('');
    expect(params).toEqual([]);
  });

  it('emits GROUP BY for a column list', () => {
    const params: SqlParameter[] = [];
    const options: QueryOptions = { groupBy: { columns: ['name', 'city'] } };
    expect(emitGroup(params, options)).toBe(' GROUP BY name, city');
  });

  it('accepts a bare string[] as groupBy', () => {
    const params: SqlParameter[] = [];
    const options: QueryOptions = { groupBy: ['name'] };
    expect(emitGroup(params, options)).toBe(' GROUP BY name');
  });

  it('guards empty columns — no dangling GROUP BY', () => {
    const params: SqlParameter[] = [];
    const options: QueryOptions = { groupBy: { columns: [] } };
    expect(emitGroup(params, options)).toBe('');
    expect(params).toEqual([]);
  });

  it('emits HAVING and collects its parameters', () => {
    const params: SqlParameter[] = [];
    const options: QueryOptions = {
      groupBy: { columns: ['name'], having: { condition: 'COUNT(*) > ?', parameters: [5] } }
    };
    expect(emitGroup(params, options)).toBe(' GROUP BY name HAVING COUNT(*) > ?');
    expect(params).toEqual([5]);
  });

  it('emits HAVING alone when columns are empty', () => {
    const params: SqlParameter[] = [];
    const options: QueryOptions = {
      groupBy: { columns: [], having: { condition: 'COUNT(*) > ?', parameters: [5] } }
    };
    expect(emitGroup(params, options)).toBe(' HAVING COUNT(*) > ?');
    expect(params).toEqual([5]);
  });
});

describe('emitOrder', () => {
  it('returns empty string when there is no ordering', () => {
    expect(emitOrder({})).toBe('');
    expect(emitOrder({ orderBy: [] })).toBe('');
  });

  it('emits ORDER BY with directions', () => {
    const options: QueryOptions = {
      orderBy: [
        { column: 'name', direction: 'ASC' },
        { column: 'id', direction: 'DESC' }
      ]
    };
    expect(emitOrder(options)).toBe(' ORDER BY name ASC, id DESC');
  });
});
