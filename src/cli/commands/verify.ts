import * as path from 'path';
import type { Command } from '../runtime/command';
import type { Flags } from '../runtime/types';
import { makeEffectiveConfig } from '../runtime/config';
import { NodeChecksumPort, NodeFsPort } from '../runtime/nodeAdapters';
import { SQLiteProvider } from '../../providers/SQLiteProvider';
import { PostgresProvider } from '../../providers/PostgresProvider';
import { MySqlProvider } from '../../providers/MySqlProvider';
import { MssqlProvider } from '../../providers/MssqlProvider';
import type { DatabaseProvider } from '../../providers/DatabaseProvider';

function findMigrationsIndex(fsp: NodeFsPort, migrationsDir: string): string | undefined {
  const indexCandidates = ['index.ts', 'index.js', 'index.cjs', 'index.mjs'];
  for (const name of indexCandidates) {
    const p = path.resolve(migrationsDir, name);
    if (fsp.exists(p)) return p;
  }
  return undefined;
}

export class VerifyCommand implements Command {
  public async execute(_rest: string[], flags: Flags): Promise<number> {
    const effective = makeEffectiveConfig(flags);
    const fsp = new NodeFsPort();
    const checks = new NodeChecksumPort();
    if (flags.db) {
      // DB-based checksum store: compute checksums for all files in migrationsDir
      const files = fsp
        .list(effective.migrationsDir)
        .filter((f) => /\.(ts|js|sql)$/i.test(f))
        .map((f) => path.resolve(effective.migrationsDir, f));
      const entries = files.map((file: string) => ({ file, checksum: checks.sha256(file) }));
      // Store in __migration_checksums on the same provider as configured
      const provider: DatabaseProvider = ((): DatabaseProvider => {
        switch (effective.provider) {
          case 'sqlite':
            return new SQLiteProvider(effective.connectionString);
          case 'postgresql':
            return new PostgresProvider(effective.connectionString);
          case 'mysql':
            return new MySqlProvider(effective.connectionString);
          case 'mssql':
            return new MssqlProvider(effective.connectionString);
          default:
            return new SQLiteProvider(effective.connectionString);
        }
      })();
      await provider.connect();
      // ensure table
      await provider.executeNonQuery(
        `CREATE TABLE IF NOT EXISTS __migration_checksums (file TEXT PRIMARY KEY, checksum TEXT NOT NULL, updated_at TEXT NOT NULL)`
      );
      // read existing
      const rows = await provider.executeQuery('SELECT file, checksum FROM __migration_checksums');
      const existing = new Map<string, string>(
        (rows as Array<{ file: string; checksum: string }>).map(
          (r) => [r.file, r.checksum] as const
        )
      );
      const diffs: Array<{ file: string; stored?: string; current: string }> = [];
      for (const e of entries) {
        const prev = existing.get(e.file);
        if (!prev) {
          await provider.executeNonQuery(
            'INSERT OR REPLACE INTO __migration_checksums(file, checksum, updated_at) VALUES (?, ?, ?)',
            [e.file, e.checksum, new Date().toISOString()]
          );
        } else if (prev !== e.checksum) {
          diffs.push({ file: e.file, stored: prev, current: e.checksum });
          await provider.executeNonQuery(
            'UPDATE __migration_checksums SET checksum=?, updated_at=? WHERE file=?',
            [e.checksum, new Date().toISOString(), e.file]
          );
        }
      }
      await provider.disconnect();
      if (flags.json) {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({ ok: diffs.length === 0, diffs }, null, 2));
      } else if (diffs.length > 0) {
        // eslint-disable-next-line no-console
        console.error('Checksum mismatches found:', diffs.length);
      }
      return diffs.length === 0 ? 0 : 3;
    }
    const indexPath = findMigrationsIndex(fsp, effective.migrationsDir);
    if (!indexPath) {
      if (flags.json) {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({ ok: true, reason: 'no_explicit_migrations' }, null, 2));
      } else if (!flags.quiet) {
        // eslint-disable-next-line no-console
        console.log('No explicit migrations index found');
      }
      return 0;
    }
    const checksum = checks.sha256(indexPath);
    const baselineFile = path.join(effective.migrationsDir, '.tslinq.checksum');
    if (!fsp.exists(baselineFile)) {
      if (flags.dryRun) {
        if (flags.json) {
          // eslint-disable-next-line no-console
          console.log(
            JSON.stringify({ ok: true, action: 'would_create_baseline', checksum }, null, 2)
          );
        } else if (!flags.quiet) {
          // eslint-disable-next-line no-console
          console.log('Baseline would be created');
        }
        return 0;
      }
      fsp.writeText(baselineFile, checksum);
      if (flags.json) {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({ ok: true, action: 'baseline_created', checksum }, null, 2));
      } else if (!flags.quiet) {
        // eslint-disable-next-line no-console
        console.log('Baseline created');
      }
      return 0;
    }
    const stored = fsp.readText(baselineFile).trim();
    if (stored === checksum) {
      if (flags.json) {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({ ok: true, checksum }, null, 2));
      } else if (!flags.quiet) {
        // eslint-disable-next-line no-console
        console.log('Verify OK');
      }
      return 0;
    }
    if (flags.json) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ ok: false, stored, current: checksum }, null, 2));
    } else {
      // eslint-disable-next-line no-console
      console.error('Checksum mismatch');
    }
    return 3;
  }
}
