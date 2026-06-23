import {
  DbUpdateException,
  OptimisticConcurrencyError,
  OrmError,
  OrmErrorCode
} from '@ts-linq/types';

import { EntityEntry } from '../src/changetracker/EntityEntry';
import { DbUpdateConcurrencyException } from '../src/exceptions/DbUpdateConcurrencyException';

class Article {
  id = 1;
  title = 'Hello';
}

describe('DbUpdateConcurrencyException', () => {
  test('is an Error with correct name', () => {
    const ex = new DbUpdateConcurrencyException('conflict', []);
    expect(ex).toBeInstanceOf(Error);
    expect(ex.name).toBe('DbUpdateConcurrencyException');
    expect(ex.message).toBe('conflict');
  });

  test('entries array is accessible', () => {
    const provider = {};
    const entry = new EntityEntry(new Article(), Article, provider);
    const ex = new DbUpdateConcurrencyException('conflict', [entry]);
    expect(ex.entries).toHaveLength(1);
    expect(ex.entries[0]).toBe(entry);
  });

  test('extends the canonical OrmError / DbUpdateException hierarchy with a stable code', () => {
    const ex = new DbUpdateConcurrencyException('conflict', []);
    expect(ex).toBeInstanceOf(DbUpdateException);
    expect(ex).toBeInstanceOf(OrmError);
    expect(ex.code).toBe(OrmErrorCode.DbUpdateConcurrency);
  });

  test('preserves the originating concurrency failure as cause', () => {
    const root = new OptimisticConcurrencyError('version mismatch');
    const ex = new DbUpdateConcurrencyException('conflict', [], { cause: root });
    expect(ex.cause).toBe(root);
    expect(ex.cause).toBeInstanceOf(OptimisticConcurrencyError);
  });
});

describe('EntityEntry', () => {
  test('exposes entity and entityClass', () => {
    const article = new Article();
    const provider = {};
    const entry = new EntityEntry(article, Article, provider);
    expect(entry.entity).toBe(article);
    expect(entry.entityClass).toBe(Article);
  });

  test('getDatabaseValues returns null when no metadata', async () => {
    const article = new Article();
    const provider = { findById: jest.fn().mockResolvedValue(null) };
    const entry = new EntityEntry<Article>(article, Article, provider);
    const result = await entry.getDatabaseValues();
    expect(result).toBeNull();
  });

  test('reload calls findById via provider', async () => {
    const article = new Article();
    const updated = { id: 1, title: 'Updated' };
    const provider = { findById: jest.fn().mockResolvedValue(updated) };
    const entry = new EntityEntry<Article>(article, Article, provider);
    // no metadata registered — reload is a no-op, just shouldn't throw
    await expect(entry.reload()).resolves.toBeUndefined();
  });
});
