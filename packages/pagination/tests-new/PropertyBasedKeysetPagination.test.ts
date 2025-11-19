import { describe, it, expect } from '@jest/globals';
import fc from 'fast-check';

/**
 * Property-based test: keyset pagination should return strictly increasing keys
 * and not skip/duplicate items between sequential calls.
 * 
 * This validates a pure model (no DB): ordered array + keyset simulation.
 * Ensures that keyset pagination maintains data integrity through monotonic ordering.
 */
describe('Property-Based Testing: Keyset Pagination Correctness', () => {
  it('should yield contiguous, non-duplicated chunks with monotonic keyset', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -1000, max: 1000 }), { minLength: 0, maxLength: 200 }),
        fc.integer({ min: 1, max: 20 }),
        (data, pageSize) => {
          // Sort and deduplicate data
          const sorted = [...data].sort((a, b) => a - b);
          const unique = Array.from(new Set(sorted));
          
          let after: number | null = null;
          const seen: number[] = [];

          // Simulate sequential pagination
          for (let i = 0; i < 100; i++) {
            const page = unique
              .filter((x) => (after === null ? true : x > after))
              .slice(0, pageSize);
            
            if (page.length === 0) break;
            
            // Property 1: Strictly increasing within page
            for (let j = 1; j < page.length; j++) {
              expect(page[j]).toBeGreaterThan(page[j - 1]);
            }
            
            // Property 2: No overlaps between pages
            for (const v of page) {
              expect(seen.includes(v)).toBe(false);
            }
            
            seen.push(...page);
            after = page[page.length - 1];
          }

          // Property 3: Seen is exactly a prefix of the unique sequence
          for (let k = 0; k < seen.length; k++) {
            expect(seen[k]).toBe(unique[k]);
          }
          
          return true;
        }
      ),
      { verbose: false, numRuns: 100 }
    );
  });

  it('should handle empty arrays without errors', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        (pageSize) => {
          const data: number[] = [];
          const page = data.slice(0, pageSize);
          
          expect(page).toEqual([]);
          return true;
        }
      ),
      { verbose: false }
    );
  });

  it('should handle single-page results correctly', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 1, maxLength: 10 }),
        (data) => {
          const pageSize = data.length + 10; // Larger than data
          const sorted = [...data].sort((a, b) => a - b);
          const unique = Array.from(new Set(sorted));
          
          const page = unique.slice(0, pageSize);
          
          // Single page should contain all unique items
          expect(page.length).toBe(unique.length);
          
          // Should be sorted
          for (let i = 1; i < page.length; i++) {
            expect(page[i]).toBeGreaterThan(page[i - 1]);
          }
          
          return true;
        }
      ),
      { verbose: false }
    );
  });

  it('should maintain correct ordering across multiple pages', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 500 }), { minLength: 10, maxLength: 100 }),
        fc.integer({ min: 2, max: 15 }),
        (data, pageSize) => {
          const sorted = [...data].sort((a, b) => a - b);
          const unique = Array.from(new Set(sorted));
          
          const allPages: number[][] = [];
          let after: number | null = null;

          // Collect all pages
          while (true) {
            const page = unique
              .filter((x) => (after === null ? true : x > after))
              .slice(0, pageSize);
            
            if (page.length === 0) break;
            
            allPages.push(page);
            after = page[page.length - 1];
          }

          // Flatten all pages
          const concatenated = allPages.flat();
          
          // Should match unique array exactly
          expect(concatenated).toEqual(unique);
          
          return true;
        }
      ),
      { verbose: false, numRuns: 50 }
    );
  });
});
