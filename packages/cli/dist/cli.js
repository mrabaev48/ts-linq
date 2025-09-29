#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
/* Minimal CLI: prints SQLite diff SQL using current metadata. */
require("reflect-metadata");
const core_1 = require("@ts-linq/core");
const sqlite_1 = require("@ts-linq/sqlite");
const postgres_1 = require("@ts-linq/postgres");
const mysql_1 = require("@ts-linq/mysql");
const mssql_1 = require("@ts-linq/mssql");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function createProviderFromEnv() {
    const kind = (process.env.DB_PROVIDER || 'sqlite').toLowerCase();
    if (kind === 'postgresql' || kind === 'postgres' || kind === 'pg') {
        const url = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
        if (!url)
            throw new Error('POSTGRES_URL/DATABASE_URL is required for DB_PROVIDER=postgresql');
        return new postgres_1.PostgresProvider(url);
    }
    if (kind === 'mysql') {
        const url = process.env.MYSQL_URL || process.env.DATABASE_URL || '';
        if (!url)
            throw new Error('MYSQL_URL/DATABASE_URL is required for DB_PROVIDER=mysql');
        return new mysql_1.MySqlProvider(url);
    }
    if (kind === 'mssql' || kind === 'sqlserver') {
        const url = process.env.MSSQL_URL || process.env.DATABASE_URL || '';
        if (!url)
            throw new Error('MSSQL_URL/DATABASE_URL is required for DB_PROVIDER=mssql');
        return new mssql_1.MssqlProvider(url);
    }
    const conn = process.env.SQLITE_URL || ':memory:';
    return new sqlite_1.SQLiteProvider(conn);
}
function tryLoadConfig(cwd) {
    const candidates = [
        'ts-linq.config.ts',
        'ts-linq.config.cjs',
        'ts-linq.config.js',
        'ts-linq.config.json'
    ];
    for (const name of candidates) {
        const p = path.resolve(cwd, name);
        if (!fs.existsSync(p))
            continue;
        try {
            if (name.endsWith('.json'))
                return JSON.parse(fs.readFileSync(p, 'utf8'));
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const mod = require(p);
            return (mod && (mod.default || mod));
        }
        catch (e) {
            console.error(`Failed to load config ${name}:`, e.message);
            return undefined;
        }
    }
    return undefined;
}
function resolveDialect(label) {
    const allowed = ['sqlite', 'postgresql', 'mysql', 'mssql'];
    return allowed.includes(label)
        ? label
        : 'sqlite';
}
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath))
        fs.mkdirSync(dirPath, { recursive: true });
}
function writeFileIfMissing(filePath, contents) {
    if (!fs.existsSync(filePath)) {
        ensureDir(path.dirname(filePath));
        fs.writeFileSync(filePath, contents, 'utf8');
    }
}
async function main() {
    const [, , cmd, arg1, _arg2] = process.argv;
    // Handle project initialization without requiring a DB connection
    if (cmd === 'init') {
        const dest = path.resolve(process.cwd(), arg1 || '.');
        if (arg1)
            ensureDir(dest);
        // tsconfig.json tuned for TS5 Stage-3 decorators
        const tsconfig = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "useDefineForClassFields": true,
    "emitDecoratorMetadata": true,
    "sourceMap": true,
    "outDir": "dist",
    "baseUrl": ".",
    "paths": {
      "@src/*": ["src/*"]
    }
  },
  "include": ["src/**/*", "migrations/**/*"],
  "exclude": ["node_modules", "dist"]
}
`;
        // Basic ORM config
        const configTs = `export default {
  provider: process.env.DB_PROVIDER || 'sqlite',
  connection: process.env.DATABASE_URL || process.env.SQLITE_URL || 'file:app.db',
  migrations: './migrations',
  entities: './src/entities'
};
`;
        // Example entity using Stage-3 decorators
        const userEntity = `import { Entity, Column, PrimaryKey } from '@ts-linq/core';

@Entity('users')
export class User {
  @PrimaryKey()
  public id!: number;

  @Column()
  public name!: string;
}
`;
        // Example DbContext
        const dbContext = `import 'reflect-metadata';
import { DbContext } from '@ts-linq/core';
import { SQLiteProvider } from '@ts-linq/sqlite';

export class AppDbContext extends DbContext {
  public constructor() {
    super({ provider: new SQLiteProvider(process.env.SQLITE_URL || 'file:app.db') });
  }
}
`;
        // env example
        const envExample = `# Database provider: sqlite | postgresql | mysql | mssql
DB_PROVIDER=sqlite
# For sqlite
SQLITE_URL=file:app.db
# For Postgres
# POSTGRES_URL=postgres://user:pass@localhost:5432/db
# For MySQL
# MYSQL_URL=mysql://user:pass@localhost:3306/db
# For MSSQL
# MSSQL_URL=mssql://user:pass@localhost:1433/db
`;
        // Scaffold
        writeFileIfMissing(path.join(dest, 'tsconfig.json'), tsconfig);
        writeFileIfMissing(path.join(dest, 'ts-linq.config.ts'), configTs);
        writeFileIfMissing(path.join(dest, '.env.example'), envExample);
        writeFileIfMissing(path.join(dest, 'src', 'entities', 'User.ts'), userEntity);
        writeFileIfMissing(path.join(dest, 'src', 'context', 'AppDbContext.ts'), dbContext);
        ensureDir(path.join(dest, 'migrations'));
        // Keep migrations dir tracked
        writeFileIfMissing(path.join(dest, 'migrations', '.gitkeep'), '');
        console.log(`Initialized ts-linq project at ${dest}`);
        console.log('Next steps:');
        console.log('  1) cp .env.example .env  # и заполнить подключение к БД');
        console.log('  2) npx ts-linq schema:export  # создать snapshot');
        console.log("  3) npx ts-linq generate Initial  # создать пустую миграцию (опционально)");
        console.log('  4) npx ts-linq schema:apply    # применить схему');
        return;
    }
    const provider = createProviderFromEnv();
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
    }
    else if (cmd === 'rollback') {
        console.warn('Rollback is not supported for diff-based migrations. Please provide explicit down migrations.');
        process.exitCode = 2;
    }
    else if (cmd === 'generate') {
        const name = (arg1 || 'Migration').replace(/\s+/g, '_');
        const ts = new Date()
            .toISOString()
            .replace(/[-:TZ.]/g, '')
            .slice(0, 14);
        const dir = path.resolve(process.cwd(), 'migrations');
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, `${ts}_${name}.ts`);
        const template = `import { Migration } from '@ts-linq/core';\n\nexport class ${name} extends Migration {\n  protected get name() { return '${name}'; }\n  protected get version() { return '${ts}'; }\n  public async up(): Promise<void> {\n    // TODO: write your DDL here\n  }\n  public async down(): Promise<void> {\n    // TODO: write your rollback here\n  }\n}\n`;
        fs.writeFileSync(file, template, 'utf8');
        console.log(`Created ${file}`);
    }
    else if (cmd === 'seed') {
        const sqlFile = arg1 || path.resolve(process.cwd(), 'seeds.sql');
        if (!fs.existsSync(sqlFile)) {
            console.error(`Seed file not found: ${sqlFile}`);
            process.exitCode = 2;
        }
        else {
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
    }
    else if (cmd === 'validate:env') {
        const required = ['NODE_ENV'];
        const missing = required.filter((k) => !process.env[k]);
        if (missing.length) {
            console.error(`Missing required environment variables: ${missing.join(', ')}`);
            process.exitCode = 2;
        }
        else {
            console.log('Environment validation: OK');
        }
    }
    else if (cmd === 'schema:export') {
        const out = arg1 || path.resolve(process.cwd(), 'schema.snapshot.json');
        const snapshot = new core_1.SchemaSnapshotBuilder().buildExpectedFromMetadata();
        const json = new core_1.SchemaSnapshotSerializer().serialize(snapshot);
        fs.writeFileSync(out, json, 'utf8');
        console.log(`Schema snapshot saved to ${out}`);
    }
    else if (cmd === 'schema:diff') {
        const file = arg1 || path.resolve(process.cwd(), 'schema.snapshot.json');
        if (!fs.existsSync(file)) {
            console.error(`Snapshot file not found: ${file}`);
            process.exitCode = 2;
        }
        else {
            const target = new core_1.SchemaSnapshotSerializer().deserialize(fs.readFileSync(file, 'utf8'));
            const actual = await new core_1.SchemaSnapshotBuilder(provider).buildActualFromProvider(target);
            const diff = (0, core_1.compareSchemas)(target, actual);
            const dialect = resolveDialect(provider.providerLabel);
            const rendered = (0, core_1.generateMigrationFromDiff)(diff, dialect);
            for (const sql of rendered.up)
                console.log(sql);
        }
    }
    else if (cmd === 'schema:apply') {
        const file = arg1 || path.resolve(process.cwd(), 'schema.snapshot.json');
        if (!fs.existsSync(file)) {
            console.error(`Snapshot file not found: ${file}`);
            process.exitCode = 2;
        }
        else {
            const target = new core_1.SchemaSnapshotSerializer().deserialize(fs.readFileSync(file, 'utf8'));
            const actual = await new core_1.SchemaSnapshotBuilder(provider).buildActualFromProvider(target);
            const diff = (0, core_1.compareSchemas)(target, actual);
            const dialect = resolveDialect(provider.providerLabel);
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
    }
    else if (cmd === 'schema:validate') {
        const file = arg1 || path.resolve(process.cwd(), 'schema.snapshot.json');
        if (!fs.existsSync(file)) {
            console.error(`Snapshot file not found: ${file}`);
            process.exitCode = 2;
        }
        else {
            const target = new core_1.SchemaSnapshotSerializer().deserialize(fs.readFileSync(file, 'utf8'));
            const actual = await new core_1.SchemaSnapshotBuilder(provider).buildActualFromProvider(target);
            const diff = (0, core_1.compareSchemas)(target, actual);
            const rendered = (0, core_1.generateMigrationFromDiff)(diff, resolveDialect(provider.providerLabel));
            if (rendered.up.length > 0) {
                console.error(`Schema drift detected: ${rendered.up.length} change(s) required`);
                for (const sql of rendered.up)
                    console.error(sql);
                process.exitCode = 1;
            }
            else {
                console.log('Schema validation: OK (no drift)');
            }
        }
    }
    else if (cmd === 'config:check') {
        const cfg = tryLoadConfig(process.cwd());
        if (!cfg || typeof cfg !== 'object') {
            console.error('Config not found or invalid. Looked for ts-linq.config.{ts,cjs,js,json}');
            process.exitCode = 2;
        }
        else {
            const c = cfg;
            const missing = [];
            if (!c.provider || typeof c.provider !== 'string')
                missing.push('provider');
            if (!c.connection || typeof c.connection !== 'string')
                missing.push('connection');
            if (!c.migrations || typeof c.migrations !== 'string')
                missing.push('migrations');
            if (!c.entities || typeof c.entities !== 'string')
                missing.push('entities');
            if (missing.length) {
                console.error(`Config validation failed. Missing/invalid: ${missing.join(', ')}`);
                process.exitCode = 1;
            }
            else {
                console.log('Config validation: OK');
            }
        }
    }
    else {
        for (const step of steps)
            console.log(step.sql);
    }
    await provider.disconnect();
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map