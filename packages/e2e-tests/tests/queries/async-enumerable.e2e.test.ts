import { Column, Entity, PrimaryKey } from '@ts-linq/core';
import { DbContext } from '@ts-linq/orm';

import { dropTables, setupTestDatabase, teardownTestDatabase } from '../../src/setup';

@Entity({ name: 'async_stream_items' })
class AsyncStreamItem {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  label!: string;

  @Column({ type: 'number' })
  value!: number;
}

class StreamDbContext extends DbContext {}

const run = process.env.SKIP_DB_TESTS !== '1';
(run
  ? describe.each(['postgresql', 'mysql', 'mssql'])
  : describe.skip.each(['postgresql', 'mysql', 'mssql']))(
  'E2E Async Streaming - %s',
  (providerName) => {
    let harness: any;
    let provider: any;
    let context: StreamDbContext;

    beforeEach(async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      ({ harness, provider } = await setupTestDatabase(providerName as any));
      context = new StreamDbContext({ provider });
      await context.ensureCreated();

      const set = context.set(AsyncStreamItem);
      for (let i = 1; i <= 50; i++) {
        const item = new AsyncStreamItem();
        item.label = `item-${i}`;
        item.value = i * 10;
        set.add(item);
      }
      await context.saveChanges();
    });

    afterEach(async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;
      await dropTables(provider, ['async_stream_items']);
      await context.dispose();
      await teardownTestDatabase(harness);
    });

    // ── asAsyncEnumerable ──────────────────────────────────────────────────

    it('asAsyncEnumerable — collects all 50 rows via for-await', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const items: AsyncStreamItem[] = [];
      for await (const item of context.set(AsyncStreamItem).asAsyncEnumerable()) {
        items.push(item);
      }

      expect(items).toHaveLength(50);
      expect(items.every((i) => i instanceof AsyncStreamItem)).toBe(true);
      expect(items.every((i) => typeof i.id === 'number')).toBe(true);
      expect(items.every((i) => typeof i.label === 'string')).toBe(true);
    });

    it('asAsyncEnumerable — respects .where() filter', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const items: AsyncStreamItem[] = [];
      for await (const item of context
        .set(AsyncStreamItem)
        .where((i) => i.value > 200)
        .asAsyncEnumerable()) {
        items.push(item);
      }

      // value > 200 means items 21-50 (value = 210..500)
      expect(items.length).toBe(30);
      expect(items.every((i) => i.value > 200)).toBe(true);
    });

    it('asAsyncEnumerable — respects .take(n)', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const items: AsyncStreamItem[] = [];
      for await (const item of context.set(AsyncStreamItem).take(5).asAsyncEnumerable()) {
        items.push(item);
      }

      expect(items).toHaveLength(5);
    });

    it('asAsyncEnumerable — stops on pre-aborted signal', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const signal = AbortSignal.abort();
      let threw = false;
      try {
        for await (const _ of context.set(AsyncStreamItem).asAsyncEnumerable(signal)) {
          // should not reach here
        }
      } catch (err) {
        threw = true;
        expect((err as Error).message).toBe('Operation aborted');
      }
      expect(threw).toBe(true);
    });

    // ── forEachAsync ───────────────────────────────────────────────────────

    it('forEachAsync — action is called for each row', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const labels: string[] = [];
      await context.set(AsyncStreamItem).forEachAsync((item) => {
        labels.push(item.label);
      });

      expect(labels).toHaveLength(50);
      expect(labels.every((l) => l.startsWith('item-'))).toBe(true);
    });

    it('forEachAsync — works with async action', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const values: number[] = [];
      await context.set(AsyncStreamItem).forEachAsync(async (item) => {
        await Promise.resolve();
        values.push(item.value);
      });

      expect(values).toHaveLength(50);
    });

    // ── toDictionaryAsync ──────────────────────────────────────────────────

    it('toDictionaryAsync — key-only builds Map<id, entity>', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const map = await context.set(AsyncStreamItem).toDictionaryAsync((i) => i.id);

      expect(map).toBeInstanceOf(Map);
      expect(map.size).toBe(50);
      for (const [key, value] of map) {
        expect(typeof key).toBe('number');
        expect(value).toBeInstanceOf(AsyncStreamItem);
        expect(value.id).toBe(key);
      }
    });

    it('toDictionaryAsync — key + element selector projects values', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      const map = await context.set(AsyncStreamItem).toDictionaryAsync(
        (i: AsyncStreamItem) => i.id,
        (i: AsyncStreamItem) => i.label
      );

      expect(map).toBeInstanceOf(Map);
      expect(map.size).toBe(50);
      for (const [key, label] of map) {
        expect(typeof label).toBe('string');
        expect(label).toBe(`item-${key}`);
      }
    });

    it('toDictionaryAsync — throws on duplicate keys', async () => {
      if (process.env.SKIP_DB_TESTS === '1') return;

      // Use a constant key selector — all items map to the same key
      await expect(
        context.set(AsyncStreamItem).toDictionaryAsync(() => 'same-key')
      ).rejects.toThrow('An item with the same key has already been added. Key: same-key');
    });
  }
);
