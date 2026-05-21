import { HierarchyId } from '@ts-linq/core';
import { decodeLtree, encodeLtree } from '@ts-linq/provider-postgres';

import { dropTables, setupTestDatabase, teardownTestDatabase } from '../../src/setup';

// ─── Pure unit tests (no DB required) ────────────────────────────────────────

describe('HierarchyId (no DB)', () => {
  test('parse and getLevel', () => {
    expect(HierarchyId.getRoot().getLevel()).toBe(0);
    expect(HierarchyId.parse('/1/').getLevel()).toBe(1);
    expect(HierarchyId.parse('/1/2/3/').getLevel()).toBe(3);
  });

  test('getAncestor', () => {
    const h = HierarchyId.parse('/1/2/3/');
    expect(h.getAncestor(1).toString()).toBe('/1/2/');
    expect(h.getAncestor(2).toString()).toBe('/1/');
    expect(h.getAncestor(3).toString()).toBe('/');
  });

  test('isDescendantOf', () => {
    const root = HierarchyId.getRoot();
    const child = HierarchyId.parse('/1/2/');
    expect(child.isDescendantOf(root)).toBe(true);
    expect(child.isDescendantOf(HierarchyId.parse('/1/'))).toBe(true);
    expect(child.isDescendantOf(HierarchyId.parse('/2/'))).toBe(false);
    expect(root.isDescendantOf(root)).toBe(true);
  });

  test('getDescendant returns a child node', () => {
    const parent = HierarchyId.parse('/1/');
    const child = parent.getDescendant();
    expect(child.isDescendantOf(parent)).toBe(true);
    expect(child.getLevel()).toBe(2);
  });

  test('toString round-trips', () => {
    const paths = ['/', '/1/', '/1/2/', '/1/2/3/'];
    for (const p of paths) {
      expect(HierarchyId.parse(p).toString()).toBe(p);
    }
  });

  test('toLtreeString', () => {
    expect(HierarchyId.getRoot().toLtreeString()).toBe('');
    expect(HierarchyId.parse('/1/').toLtreeString()).toBe('1');
    expect(HierarchyId.parse('/1/2/3/').toLtreeString()).toBe('1.2.3');
  });

  test('ltree codec round-trip', () => {
    const h = HierarchyId.parse('/1/2/3/');
    expect(decodeLtree(encodeLtree(h)).toString()).toBe('/1/2/3/');
  });
});

// ─── DB-backed tests (PostgreSQL with ltree extension) ───────────────────────

const run = process.env.SKIP_DB_TESTS !== '1';

(run ? describe : describe.skip)('E2E HierarchyId (PostgreSQL / ltree)', () => {
  let harness: any;

  let provider: any;
  let ltreeAvailable = false;

  beforeAll(async () => {
    ({ harness, provider } = await setupTestDatabase('postgresql'));

    try {
      await provider.executeNonQuery('CREATE EXTENSION IF NOT EXISTS ltree');
      ltreeAvailable = true;
    } catch {
      ltreeAvailable = false;
    }

    if (ltreeAvailable) {
      await provider.executeNonQuery('DROP TABLE IF EXISTS e2e_hierarchy_nodes');
      await provider.executeNonQuery(`
        CREATE TABLE e2e_hierarchy_nodes (
          id    SERIAL PRIMARY KEY,
          label TEXT NOT NULL,
          path  ltree NOT NULL
        )
      `);
    }
  });

  afterAll(async () => {
    if (ltreeAvailable) {
      await dropTables(provider, ['e2e_hierarchy_nodes']);
    }
    await teardownTestDatabase(harness);
  });

  test('insert and retrieve ltree path', async () => {
    if (!ltreeAvailable) return;
    const h = HierarchyId.parse('/1/2/');
    await provider.executeNonQuery(
      `INSERT INTO e2e_hierarchy_nodes(label, path) VALUES($1, $2::ltree)`,
      ['node', encodeLtree(h)]
    );
    const rows = (await provider.executeQuery(
      `SELECT label, path::text AS path FROM e2e_hierarchy_nodes WHERE label = $1`,
      ['node']
    )) as Array<{ label: string; path: string }>;
    expect(rows[0]?.path).toBe('1.2');
    const decoded = decodeLtree(rows[0]!.path);
    expect(decoded.toString()).toBe('/1/2/');
  });

  test('descendant query with <@ operator', async () => {
    if (!ltreeAvailable) return;
    await provider.executeNonQuery(
      `INSERT INTO e2e_hierarchy_nodes(label, path) VALUES($1, $2::ltree), ($3, $4::ltree)`,
      ['root_child', '1', 'deep_child', '1.2.3']
    );
    const ancestor = HierarchyId.parse('/1/');
    const rows = (await provider.executeQuery(
      `SELECT label FROM e2e_hierarchy_nodes WHERE path <@ $1::ltree ORDER BY path`,
      [encodeLtree(ancestor)]
    )) as Array<{ label: string }>;
    const labels = rows.map((r) => r.label);
    expect(labels).toContain('root_child');
    expect(labels).toContain('deep_child');
  });
});
