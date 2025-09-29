import * as fs from 'fs';
import * as path from 'path';

export function getFlag(argv: string[], flag: string): string | boolean | undefined {
  const long = `--${flag}`;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === long) {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) return next;
      return true;
    }
    if (a.startsWith(`${long}=`)) return a.slice(long.length + 1);
  }
  return undefined;
}

export function resolveDialect(label: string): 'sqlite' | 'postgresql' | 'mysql' | 'mssql' {
  const allowed = ['sqlite', 'postgresql', 'mysql', 'mssql'] as const;
  return (allowed as readonly string[]).includes(label)
    ? (label as (typeof allowed)[number])
    : 'sqlite';
}

export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

export function writeFileIfMissing(filePath: string, contents: string): void {
  if (!fs.existsSync(filePath)) {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, contents, 'utf8');
  }
}

export function validateEnv(required: string[]): boolean {
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    // eslint-disable-next-line no-console
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    return false;
  }
  return true;
}
