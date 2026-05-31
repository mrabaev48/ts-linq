import { MetadataStorage } from '@ts-linq/metadata';
import {
  compareModelSeeds,
  generateMigrationFromDiff,
  ModelSnapshotBuilder
} from '@ts-linq/migrations';
import { ModelBuilder } from '@ts-linq/orm';

/**
 * Seed data integration tests (no live DB required).
 *
 * Uses fluent-only entity configuration so test isolation works correctly:
 * decorator metadata is written once at class definition time (cannot be recreated
 * after MetadataStorage.clear()), but fluent configuration is re-applied each time.
 */

afterEach(() => {
  MetadataStorage.getInstance().clear();
});

// ── Plain classes (no decorators — fully fluent config) ───────────────────────

class Role {
  id!: number;
  name!: string;
}

class Country {
  code!: string;
  label!: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function applySeeds(configure: (mb: ModelBuilder) => void): void {
  const registry = MetadataStorage.getInstance();
  const mb = new ModelBuilder(registry);
  configure(mb);
  mb._finalize();
}

function takeSnapshot() {
  return new ModelSnapshotBuilder().buildFromMetadata();
}

function baseRole(mb: ModelBuilder) {
  mb.entity(Role, (b) => {
    b.toTable('roles');
    b.hasKey('id');
    b.property((r) => r.id).hasColumnName('id');
    b.property((r) => r.name).hasColumnName('name');
  });
}

function baseCountry(mb: ModelBuilder) {
  mb.entity(Country, (b) => {
    b.toTable('countries');
    b.hasKey('code');
    b.property((c) => c.code).hasColumnName('code');
    b.property((c) => c.label).hasColumnName('label');
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('HasData — seed data diffing', () => {
  it('generates INSERT sql for new seed rows (roll forward)', () => {
    // prev: no seeds
    applySeeds((mb) => baseRole(mb));
    const prev = takeSnapshot();

    // current: seeds added
    applySeeds((mb) => {
      baseRole(mb);
      mb.entity(Role, (b) => {
        b.hasData({ id: 1, name: 'admin' }, { id: 2, name: 'user' });
      });
    });
    const current = takeSnapshot();

    const seedOps = compareModelSeeds(prev, current);
    expect(seedOps).toHaveLength(2);
    expect(seedOps.every((op) => op.kind === 'insert')).toBe(true);

    const diff = { tables: [], seedOps };
    const { up, down } = generateMigrationFromDiff(diff, 'postgresql');

    expect(up).toHaveLength(2);
    expect(up.every((s) => s.startsWith('INSERT INTO'))).toBe(true);
    expect(up[0]).toContain('"roles"');

    expect(down).toHaveLength(2);
    expect(down.every((s) => s.startsWith('DELETE FROM'))).toBe(true);
  });

  it('generates DELETE sql when seed rows are removed', () => {
    applySeeds((mb) => {
      baseRole(mb);
      mb.entity(Role, (b) => {
        b.hasData({ id: 1, name: 'admin' }, { id: 2, name: 'user' });
      });
    });
    const prev = takeSnapshot();

    applySeeds((mb) => {
      baseRole(mb);
      mb.entity(Role, (b) => {
        b.hasData({ id: 1, name: 'admin' }); // id:2 removed
      });
    });
    const current = takeSnapshot();

    const seedOps = compareModelSeeds(prev, current);
    expect(seedOps).toHaveLength(1);
    expect(seedOps[0].kind).toBe('delete');

    const diff = { tables: [], seedOps };
    const { up } = generateMigrationFromDiff(diff, 'postgresql');
    expect(up[0]).toContain('DELETE FROM');
    expect(up[0]).toContain('"roles"');
  });

  it('generates UPDATE sql when non-PK columns change', () => {
    applySeeds((mb) => {
      baseRole(mb);
      mb.entity(Role, (b) => {
        b.hasData({ id: 1, name: 'admin' });
      });
    });
    const prev = takeSnapshot();

    applySeeds((mb) => {
      baseRole(mb);
      mb.entity(Role, (b) => {
        b.hasData({ id: 1, name: 'superadmin' });
      });
    });
    const current = takeSnapshot();

    const seedOps = compareModelSeeds(prev, current);
    expect(seedOps).toHaveLength(1);
    expect(seedOps[0].kind).toBe('update');

    const diff = { tables: [], seedOps };
    const { up, down } = generateMigrationFromDiff(diff, 'postgresql');
    expect(up[0]).toContain('UPDATE');
    expect(up[0]).toContain("'superadmin'");
    expect(down[0]).toContain("'admin'");
  });

  it('emits no ops when seed data is identical (idempotent)', () => {
    const seeds = (mb: ModelBuilder) => {
      baseRole(mb);
      mb.entity(Role, (b) => {
        b.hasData({ id: 1, name: 'admin' }, { id: 2, name: 'user' });
      });
    };

    applySeeds(seeds);
    const prev = takeSnapshot();

    applySeeds(seeds);
    const current = takeSnapshot();

    const seedOps = compareModelSeeds(prev, current);
    expect(seedOps).toHaveLength(0);
  });

  it('snapshot stores seed rows in sorted (deterministic) order', () => {
    applySeeds((mb) => {
      baseRole(mb);
      mb.entity(Role, (b) => {
        b.hasData({ id: 3, name: 'viewer' }, { id: 1, name: 'admin' }, { id: 2, name: 'user' });
      });
    });
    const snap = takeSnapshot();

    const roleTable = snap.tables.find((t) => t.name === 'roles');
    expect(roleTable?.seedData).toHaveLength(3);
    const ids = roleTable!.seedData!.map((r) => r['id']);
    expect(ids).toEqual([1, 2, 3]);
  });

  it('mirrors EF Core HasData verbatim syntax: hasData(new T { ... }, new T { ... })', () => {
    applySeeds((mb) => {
      baseCountry(mb);
      mb.entity(Country, (b) => {
        b.hasData({ code: 'US', label: 'United States' }, { code: 'EE', label: 'Estonia' });
      });
    });
    const snap = takeSnapshot();

    const table = snap.tables.find((t) => t.name === 'countries');
    expect(table?.seedData).toHaveLength(2);
    expect(table?.seedData?.find((r) => r['code'] === 'EE')).toBeTruthy();
  });

  it('generates correct INSERT SQL for all three dialects', () => {
    applySeeds((mb) => baseRole(mb));
    const prev = takeSnapshot();

    applySeeds((mb) => {
      baseRole(mb);
      mb.entity(Role, (b) => {
        b.hasData({ id: 1, name: 'admin' });
      });
    });
    const current = takeSnapshot();

    const seedOps = compareModelSeeds(prev, current);
    const diff = { tables: [], seedOps };

    const pg = generateMigrationFromDiff(diff, 'postgresql');
    expect(pg.up[0]).toContain('"roles"');

    const mysql = generateMigrationFromDiff(diff, 'mysql');
    expect(mysql.up[0]).toContain('`roles`');

    const mssql = generateMigrationFromDiff(diff, 'mssql');
    expect(mssql.up[0]).toContain('[roles]');
  });
});
