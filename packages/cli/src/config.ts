import * as fs from 'fs';
import * as path from 'path';

export function tryLoadConfig(cwd: string): unknown | undefined {
  const candidates = [
    'ts-linq.config.ts',
    'ts-linq.config.cjs',
    'ts-linq.config.js',
    'ts-linq.config.json'
  ];
  for (const name of candidates) {
    const p = path.resolve(cwd, name);
    if (!fs.existsSync(p)) continue;
    try {
      if (name.endsWith('.json')) return JSON.parse(fs.readFileSync(p, 'utf8'));

      const mod = require(p);
      return (mod && (mod.default || mod)) as unknown;
    } catch (e) {
      console.error(`Failed to load config ${name}:`, (e as Error).message);
      return undefined;
    }
  }
  return undefined;
}
