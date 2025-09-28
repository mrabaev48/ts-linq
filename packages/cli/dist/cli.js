#!/usr/bin/env node
'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            }
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, '__esModule', { value: true });
/* Minimal CLI: prints SQLite diff SQL using current metadata. */
require('reflect-metadata');
const core_1 = require('@ts-linq/core');
const sqlite_1 = require('@ts-linq/sqlite');
const fs = __importStar(require('fs'));
const path = __importStar(require('path'));
async function main() {
  const [, , cmd, arg1, arg2] = process.argv;
  const conn = process.env.SQLITE_URL || ':memory:';
  const provider = new sqlite_1.SQLiteProvider(conn);
  await provider.connect();
  const gen = new core_1.DiffMigrationGenerator(provider);
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
  } else if (cmd === 'schema:export') {
    const out = arg1 || path.resolve(process.cwd(), 'schema.snapshot.json');
    const snapshot = new core_1.SchemaSnapshotBuilder().buildExpectedFromMetadata();
    const json = new core_1.SchemaSnapshotSerializer().serialize(snapshot);
    fs.writeFileSync(out, json, 'utf8');
    console.log(`Schema snapshot saved to ${out}`);
  } else if (cmd === 'schema:diff') {
    const file = arg1 || path.resolve(process.cwd(), 'schema.snapshot.json');
    if (!fs.existsSync(file)) {
      console.error(`Snapshot file not found: ${file}`);
      process.exitCode = 2;
    } else {
      const target = new core_1.SchemaSnapshotSerializer().deserialize(
        fs.readFileSync(file, 'utf8')
      );
      const actual = await new core_1.SchemaSnapshotBuilder(provider).buildActualFromProvider(
        target
      );
      const diff = (0, core_1.compareSchemas)(target, actual);
      const dialect = provider.providerLabel;
      const rendered = (0, core_1.generateMigrationFromDiff)(diff, dialect);
      for (const sql of rendered.up) console.log(sql);
    }
  } else if (cmd === 'schema:apply') {
    const file = arg1 || path.resolve(process.cwd(), 'schema.snapshot.json');
    if (!fs.existsSync(file)) {
      console.error(`Snapshot file not found: ${file}`);
      process.exitCode = 2;
    } else {
      const target = new core_1.SchemaSnapshotSerializer().deserialize(
        fs.readFileSync(file, 'utf8')
      );
      const actual = await new core_1.SchemaSnapshotBuilder(provider).buildActualFromProvider(
        target
      );
      const diff = (0, core_1.compareSchemas)(target, actual);
      const dialect = provider.providerLabel;
      const rendered = (0, core_1.generateMigrationFromDiff)(diff, dialect);
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
//# sourceMappingURL=cli.js.map
