#!/usr/bin/env node
/* Minimal CLI: prints SQLite diff SQL using current metadata. */
import 'reflect-metadata';
import { DiffMigrationGenerator } from '../migrations/DiffMigrationGenerator';
import { SQLiteProvider } from '../providers/SQLiteProvider';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const [,, cmd, arg1] = process.argv;
  const conn = process.env.SQLITE_URL || ':memory:';
  const provider = new SQLiteProvider(conn);
  await provider.connect();
  const gen = new DiffMigrationGenerator(provider);
  const steps = await gen.generate();
  if (cmd === 'apply-diff' || cmd === 'migrate') {
    for (const s of steps) {
      if (!s.sql.trim().startsWith('--')) {
        // eslint-disable-next-line no-await-in-loop
        await provider.executeNonQuery(s.sql);
      }
    }
    console.log(`Applied ${steps.length} step(s).`);
  } else if (cmd === 'rollback') {
    console.warn('Rollback is not supported for diff-based migrations. Please provide explicit down migrations.');
    process.exitCode = 2;
  } else if (cmd === 'generate') {
    const name = (arg1 || 'Migration').replace(/\s+/g, '_');
    const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const dir = path.resolve(process.cwd(), 'migrations');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${ts}_${name}.ts`);
    const template = `import { Migration } from '../src/migrations/Migration';\n\nexport class ${name} extends Migration {\n  protected get name() { return '${name}'; }\n  protected get version() { return '${ts}'; }\n  public async up(): Promise<void> {\n    // TODO: write your DDL here\n  }\n  public async down(): Promise<void> {\n    // TODO: write your rollback here\n  }\n}\n`;
    fs.writeFileSync(file, template, 'utf8');
    console.log(`Created ${file}`);
  } else if (cmd === 'seed') {
    const sqlFile = arg1 || path.resolve(process.cwd(), 'seeds.sql');
    if (!fs.existsSync(sqlFile)) {
      console.error(`Seed file not found: ${sqlFile}`);
      process.exitCode = 2;
    } else {
      const text = fs.readFileSync(sqlFile, 'utf8');
      const stmts = text.split(';').map(s => s.trim()).filter(Boolean);
      for (const s of stmts) {
        // eslint-disable-next-line no-await-in-loop
        await provider.executeNonQuery(s);
      }
      console.log(`Applied ${stmts.length} seed statements from ${sqlFile}`);
    }
  } else {
    for (const s of steps) console.log(s.sql);
  }
  await provider.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });


