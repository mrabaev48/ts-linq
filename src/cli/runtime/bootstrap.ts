import * as fs from 'fs';
import * as path from 'path';
import { MetadataStorage } from '../../metadata/MetadataStorage';

function tryRequire(modulePath: string): unknown | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(modulePath);
  } catch {
    return undefined;
  }
}

export async function loadBootstrapFiles(files: string[], cwd: string): Promise<void> {
  if (!files || files.length === 0) return;
  tryRequire('reflect-metadata');
  tryRequire('ts-node/register/transpile-only');
  for (const f of files) {
    const p = path.resolve(cwd, f);
    // Load bootstrap scripts; surface errors to aid debugging
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require(p);
  }
  MetadataStorage.getEntities();
}

export async function loadEntitiesFromGlobs(globs: string[], cwd: string): Promise<void> {
  if (!globs || globs.length === 0) return;
  tryRequire('reflect-metadata');
  tryRequire('ts-node/register/transpile-only');
  for (const pattern of globs) {
    if (pattern.includes('*')) {
      const dir = path.resolve(cwd, pattern.split('*')[0]);
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts') || f.endsWith('.js'));
      for (const f of files) tryRequire(path.join(dir, f));
    } else {
      tryRequire(path.resolve(cwd, pattern));
    }
  }
  MetadataStorage.getEntities();
}
