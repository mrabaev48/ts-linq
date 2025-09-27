#!/usr/bin/env node
/* Minimal CLI: prints SQLite diff SQL using current metadata. */
import 'reflect-metadata';
import { DiffMigrationGenerator, SchemaSnapshotBuilder, SchemaSnapshotSerializer, compareSchemas, generateMigrationFromDiff } from '@ts-linq/core';
import { SQLiteProvider } from '@ts-linq/sqlite';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const [, , cmd, arg1, arg2] = process.argv;
  const conn = process.env.SQLITE_URL || ':memory:';
  const provider = new SQLiteProvider(conn);
  await provider.connect();
  const gen = new DiffMigrationGenerator(provider);
  const steps = await gen.generate();
  if (cmd === 'apply-diff' || cmd === 'migrate') {
    for (const step of steps) {
      if (!step.sql.trim().startsWith('--')) {
        // eslint-disable-next-line no-await-in-loop
        await provider.executeNonQuery(step.sql);
      }
    }
    console.log(`Applied ${steps.length} step(s).`);
  } else if (cmd === 'rollback') {
    console.warn(
      'Rollback is not supported for diff-based migrations. Please provide explicit down migrations.'
    );
    process.exitCode = 2;
  } else if (cmd === 'generate') {
    const name = (arg1 || 'Migration').replace(/\s+/g, '_');
    const ts = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, '')
      .slice(0, 14);
    const dir = path.resolve(process.cwd(), 'migrations');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${ts}_${name}.ts`);
    const template = `import { Migration } from '@ts-linq/core';\n\nexport class ${name} extends Migration {\n  protected get name() { return '${name}'; }\n  protected get version() { return '${ts}'; }\n  public async up(): Promise<void> {\n    // TODO: write your DDL here\n  }\n  public async down(): Promise<void> {\n    // TODO: write your rollback here\n  }\n}\n`;
    fs.writeFileSync(file, template, 'utf8');
    console.log(`Created ${file}`);
  } else if (cmd === 'seed') {
    const sqlFile = arg1 || path.resolve(process.cwd(), 'seeds.sql');
    if (!fs.existsSync(sqlFile)) {
      console.error(`Seed file not found: ${sqlFile}`);
      process.exitCode = 2;
    } else {
      const text = fs.readFileSync(sqlFile, 'utf8');
      const statements = text
        .split(';')
        .map((stmt) => stmt.trim())
        .filter(Boolean);
      for (const statement of statements) {
        // eslint-disable-next-line no-await-in-loop
        await provider.executeNonQuery(statement);
      }
      console.log(`Applied ${statements.length} seed statements from ${sqlFile}`);
    }
  } else if (cmd === 'validate:env') {
    const required = ['NODE_ENV'];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length) {
      console.error(`Missing required environment variables: ${missing.join(', ')}`);
      process.exitCode = 2;
    } else {
      console.log('Environment validation: OK');
    }
  } else if (cmd === 'schema:export') {
    const out = arg1 || path.resolve(process.cwd(), 'schema.snapshot.json');
    const snapshot = new SchemaSnapshotBuilder().buildExpectedFromMetadata();
    const json = new SchemaSnapshotSerializer().serialize(snapshot);
    fs.writeFileSync(out, json, 'utf8');
    console.log(`Schema snapshot saved to ${out}`);
  } else if (cmd === 'schema:diff') {
    const file = arg1 || path.resolve(process.cwd(), 'schema.snapshot.json');
    if (!fs.existsSync(file)) {
      console.error(`Snapshot file not found: ${file}`);
      process.exitCode = 2;
    } else {
      const target = new SchemaSnapshotSerializer().deserialize(fs.readFileSync(file, 'utf8'));
      const actual = await new SchemaSnapshotBuilder(provider).buildActualFromProvider(target);
      const diff = compareSchemas(target, actual);
      const dialect = (provider as any).providerLabel as 'sqlite' | 'postgresql' | 'mysql' | 'mssql';
      const rendered = generateMigrationFromDiff(diff, dialect);
      for (const sql of rendered.up) console.log(sql);
    }
  } else if (cmd === 'schema:apply') {
    const file = arg1 || path.resolve(process.cwd(), 'schema.snapshot.json');
    if (!fs.existsSync(file)) {
      console.error(`Snapshot file not found: ${file}`);
      process.exitCode = 2;
    } else {
      const target = new SchemaSnapshotSerializer().deserialize(fs.readFileSync(file, 'utf8'));
      const actual = await new SchemaSnapshotBuilder(provider).buildActualFromProvider(target);
      const diff = compareSchemas(target, actual);
      const dialect = (provider as any).providerLabel as 'sqlite' | 'postgresql' | 'mysql' | 'mssql';
      const rendered = generateMigrationFromDiff(diff, dialect);
      let applied = 0;
      for (const sql of rendered.up) {
        if (!sql.trim().startsWith('--')) {
          // eslint-disable-next-line no-await-in-loop
          await provider.executeNonQuery(sql);
          applied++;
        }
      }
      console.log(`Applied ${applied} step(s) from snapshot`);
    }
  } else {
    for (const step of steps) console.log(step.sql);
  }
  await provider.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
