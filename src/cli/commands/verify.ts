import * as path from 'path';
import type { Command } from '../runtime/command';
import type { Flags } from '../runtime/types';
import { makeEffectiveConfig } from '../runtime/config';
import { NodeChecksumPort, NodeFsPort } from '../runtime/nodeAdapters';

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
          console.log(JSON.stringify({ ok: true, action: 'would_create_baseline', checksum }, null, 2));
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


