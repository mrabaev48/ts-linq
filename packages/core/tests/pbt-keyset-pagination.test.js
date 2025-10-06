'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
require('reflect-metadata');
const fast_check_1 = __importDefault(require('fast-check'));
/**
 * Property-based тест: keyset-пагинация должна возвращать строго возрастающие ключи
 * и не пропускать/не дублировать элементы при последовательных вызовах.
 * Здесь проверяем чистую модель (не БД): упорядоченный массив и симуляция keyset.
 */
describe('Property-based: keyset pagination correctness', () => {
  test('monotonic keyset yields contiguous, non-duplicated chunks', () => {
    fast_check_1.default.assert(
      fast_check_1.default.property(
        fast_check_1.default.array(fast_check_1.default.integer({ min: -1000, max: 1000 }), {
          minLength: 0,
          maxLength: 200
        }),
        fast_check_1.default.integer({ min: 1, max: 20 }),
        (data, pageSize) => {
          const sorted = [...data].sort((a, b) => a - b);
          const unique = Array.from(new Set(sorted));
          let after = null;
          const seen = [];
          for (let i = 0; i < 100; i++) {
            const page = unique
              .filter((x) => (after === null ? true : x > after))
              .slice(0, pageSize);
            if (page.length === 0) break;
            // strictly increasing within page
            for (let j = 1; j < page.length; j++) expect(page[j]).toBeGreaterThan(page[j - 1]);
            // no overlaps
            for (const v of page) expect(seen.includes(v)).toBe(false);
            seen.push(...page);
            after = page[page.length - 1];
          }
          // seen — это ровно префикс последовательности unique
          for (let k = 0; k < seen.length; k++) expect(seen[k]).toBe(unique[k]);
          return true;
        }
      ),
      { verbose: false }
    );
  });
});
//# sourceMappingURL=pbt-keyset-pagination.test.js.map
