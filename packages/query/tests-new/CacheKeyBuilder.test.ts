import { describe, expect, it } from '@jest/globals';
import type { QueryOptions } from '@ts-linq/types';

import { CacheKeyBuilder } from '../src/CacheKeyBuilder';

class TestEntity {}

describe('CacheKeyBuilder', () => {
  describe('build()', () => {
    it('produces stable keys for equivalent options', () => {
      const options: QueryOptions = {
        select: ['id', 'name'],
        where: [{ condition: 'id = ?', parameters: [1] }],
        orderBy: [{ column: 'name', direction: 'ASC' }],
        limit: 10,
        offset: 5,
        distinct: true
      };

      const key1 = CacheKeyBuilder.build(TestEntity, { ...options });
      const key2 = CacheKeyBuilder.build(TestEntity, { ...options });

      expect(key1).toBe(key2);
    });

    it('includes provider name and namespace', () => {
      const options: QueryOptions = {};

      const base = CacheKeyBuilder.build(TestEntity, options);
      const withProvider = CacheKeyBuilder.build(TestEntity, options, 'Provider1');
      const withNamespace = CacheKeyBuilder.build(TestEntity, options, undefined, 'ns1');

      expect(withProvider).not.toBe(base);
      expect(withNamespace).not.toBe(base);
      expect(withProvider).not.toBe(withNamespace);
    });

    it('produces distinct keys for different select lists', () => {
      const a = CacheKeyBuilder.build(TestEntity, { select: ['id'] });
      const b = CacheKeyBuilder.build(TestEntity, { select: ['id', 'name'] });

      expect(a).not.toBe(b);
    });

    it('produces distinct keys for different where parameters', () => {
      const a = CacheKeyBuilder.build(TestEntity, {
        where: [{ condition: 'id = ?', parameters: [1] }]
      });
      const b = CacheKeyBuilder.build(TestEntity, {
        where: [{ condition: 'id = ?', parameters: [2] }]
      });

      expect(a).not.toBe(b);
    });

    it('produces distinct keys for different orderBy', () => {
      const a = CacheKeyBuilder.build(TestEntity, {
        orderBy: [{ column: 'name', direction: 'ASC' }]
      });
      const b = CacheKeyBuilder.build(TestEntity, {
        orderBy: [{ column: 'name', direction: 'DESC' }]
      });

      expect(a).not.toBe(b);
    });

    it('produces distinct keys for different groupBy', () => {
      const a = CacheKeyBuilder.build(TestEntity, { groupBy: ['name'] });
      const b = CacheKeyBuilder.build(TestEntity, { groupBy: ['name', 'value'] });

      expect(a).not.toBe(b);
    });

    it('produces distinct keys for groupBy with having', () => {
      const a = CacheKeyBuilder.build(TestEntity, {
        groupBy: { columns: ['name'], having: { condition: 'COUNT(*) > ?', parameters: [1] } }
      });
      const b = CacheKeyBuilder.build(TestEntity, {
        groupBy: { columns: ['name'], having: { condition: 'COUNT(*) > ?', parameters: [2] } }
      });

      expect(a).not.toBe(b);
    });

    it('produces distinct keys for different joins via onColumns', () => {
      const a = CacheKeyBuilder.build(TestEntity, {
        joins: [
          {
            type: 'INNER',
            table: 'Other',
            onColumns: [
              { left: { table: 'A', column: 'id' }, right: { table: 'Other', column: 'aId' } }
            ]
          }
        ]
      });
      const b = CacheKeyBuilder.build(TestEntity, {
        joins: [
          {
            type: 'INNER',
            table: 'Other',
            onColumns: [
              { left: { table: 'A', column: 'id' }, right: { table: 'Other', column: 'bId' } }
            ]
          }
        ]
      });

      expect(a).not.toBe(b);
    });

    it('produces distinct keys for different limit/offset/distinct', () => {
      const base = CacheKeyBuilder.build(TestEntity, {});
      const withLimit = CacheKeyBuilder.build(TestEntity, { limit: 10 });
      const withOffset = CacheKeyBuilder.build(TestEntity, { offset: 5 });
      const withDistinct = CacheKeyBuilder.build(TestEntity, { distinct: true });

      expect(withLimit).not.toBe(base);
      expect(withOffset).not.toBe(base);
      expect(withDistinct).not.toBe(base);
      expect(new Set([base, withLimit, withOffset, withDistinct]).size).toBe(4);
    });
  });

  describe('buildPlanKey()', () => {
    it('strips ?(val) parameter groups from the full key', () => {
      const fullKey = CacheKeyBuilder.build(TestEntity, {
        where: [{ condition: 'id = ?', parameters: [1] }]
      });

      const planKey1 = CacheKeyBuilder.buildPlanKey(fullKey);
      const fullKey2 = CacheKeyBuilder.build(TestEntity, {
        where: [{ condition: 'id = ?', parameters: [2] }]
      });
      const planKey2 = CacheKeyBuilder.buildPlanKey(fullKey2);

      expect(planKey1).toBe(planKey2);
      expect(planKey1).not.toBe(fullKey);
    });
  });

  describe('extractCurrentParams()', () => {
    it('extracts parameters from where, groupBy.having, rawSqlSource and selectParams', () => {
      const options: QueryOptions = {
        where: [{ condition: 'id = ?', parameters: [1] }],
        groupBy: { columns: ['name'], having: { condition: 'COUNT(*) > ?', parameters: [2] } },
        rawSqlSource: { sql: 'SELECT 1', params: [3] },
        selectParams: [4]
      };

      expect(CacheKeyBuilder.extractCurrentParams(options)).toEqual([1, 2, 3, 4]);
    });

    it('returns an empty array when no parameters are present', () => {
      expect(CacheKeyBuilder.extractCurrentParams({})).toEqual([]);
    });
  });
});
