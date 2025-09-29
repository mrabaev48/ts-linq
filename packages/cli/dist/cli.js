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
const core_2 = require("@ts-linq/core");
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
function normalizeDbType(label, dbTypeRaw) {
    const t = String(dbTypeRaw || '').toLowerCase();
    if (label === 'sqlite') {
        if (/int/.test(t))
            return 'INTEGER';
        if (/real|double|float/.test(t))
            return 'REAL';
        if (/blob/.test(t))
            return 'BLOB';
        if (/date|time/.test(t))
            return 'DATETIME';
        if (/bool/.test(t))
            return 'BOOLEAN';
        return 'TEXT';
    }
    if (label === 'postgresql') {
        if (/(?:small|big)?int|serial|bigserial/.test(t))
            return 'INTEGER';
        if (/numeric|decimal/.test(t))
            return 'DECIMAL';
        if (/double|real/.test(t))
            return 'REAL';
        if (/uuid/.test(t))
            return 'UUID';
        if (/jsonb?/.test(t))
            return t.includes('jsonb') ? 'JSONB' : 'JSON';
        if (/timestamp|timestamptz|date|time/.test(t))
            return 'DATETIME';
        if (/bool/.test(t))
            return 'BOOLEAN';
        if (/bytea/.test(t))
            return 'BLOB';
        return 'TEXT';
    }
    if (label === 'mysql') {
        if (/int/.test(t))
            return 'INTEGER';
        if (/decimal|numeric/.test(t))
            return 'DECIMAL';
        if (/double|float/.test(t))
            return 'REAL';
        if (/json/.test(t))
            return 'JSON';
        if (/datetime|timestamp|date|time/.test(t))
            return 'DATETIME';
        if (/bool|tinyint\(1\)/.test(t))
            return 'BOOLEAN';
        if (/blob|binary|varbinary/.test(t))
            return 'BLOB';
        return 'TEXT';
    }
    // mssql
    if (/int|bigint|smallint|tinyint/.test(t))
        return 'INTEGER';
    if (/decimal|numeric|money|smallmoney/.test(t))
        return 'DECIMAL';
    if (/float|real/.test(t))
        return 'REAL';
    if (/datetime|smalldatetime|date|time/.test(t))
        return 'DATETIME';
    if (/bit/.test(t))
        return 'BOOLEAN';
    if (/binary|varbinary|image/.test(t))
        return 'BLOB';
    if (/uniqueidentifier/.test(t))
        return 'UUID';
    return 'TEXT';
}
function tsTypeForOrm(colType) {
    switch (colType) {
        case 'INTEGER':
        case 'REAL':
        case 'DECIMAL':
            return 'number';
        case 'BOOLEAN':
            return 'boolean';
        case 'DATETIME':
            return 'Date';
        case 'BLOB':
            return 'Buffer';
        case 'UUID':
            return 'string';
        case 'JSON':
        case 'JSONB':
            return 'unknown';
        default:
            return 'string';
    }
}
async function inspectTable(provider, label, table, schema) {
    const rows = [];
    if (label === 'sqlite') {
        const pragma = await provider.executeQuery(`PRAGMA table_info(${table})`);
        for (const r of pragma) {
            rows.push({ name: r.name, type: r.type, nullable: !r.notnull, pk: !!r.pk });
        }
    }
    else if (label === 'postgresql') {
        const sch = schema || 'public';
        const cols = await provider.executeQuery('SELECT column_name, data_type, udt_name, is_nullable, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position', [sch, table]);
        const pkCols = await provider.executeQuery("SELECT kcu.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'PRIMARY KEY' ORDER BY kcu.ordinal_position", [sch, table]);
        const pkSet = new Set(pkCols.map((x) => x.column_name));
        for (const c of cols) {
            const raw = (c.udt_name || c.data_type || '').toLowerCase();
            rows.push({
                name: c.column_name,
                type: raw,
                nullable: c.is_nullable === 'YES',
                pk: pkSet.has(c.column_name)
            });
        }
    }
    else if (label === 'mysql') {
        const cols = await provider.executeQuery('SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ORDINAL_POSITION', [table]);
        for (const c of cols) {
            rows.push({
                name: c.COLUMN_NAME,
                type: c.DATA_TYPE,
                nullable: c.IS_NULLABLE === 'YES',
                pk: c.COLUMN_KEY === 'PRI'
            });
        }
    }
    else {
        // mssql
        const sch = schema || 'dbo';
        const cols = await provider.executeQuery('SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @p1 AND TABLE_NAME = @p2 ORDER BY ORDINAL_POSITION', [sch, table]);
        const pkCols = await provider.executeQuery("SELECT k.COLUMN_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS t JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE k ON t.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND t.TABLE_SCHEMA = k.TABLE_SCHEMA WHERE t.TABLE_SCHEMA = @p1 AND t.TABLE_NAME = @p2 AND t.CONSTRAINT_TYPE = 'PRIMARY KEY' ORDER BY k.ORDINAL_POSITION", [sch, table]);
        const pkSet = new Set(pkCols.map((x) => x.COLUMN_NAME));
        for (const c of cols) {
            rows.push({
                name: c.COLUMN_NAME,
                type: c.DATA_TYPE,
                nullable: c.IS_NULLABLE === 'YES',
                pk: pkSet.has(c.COLUMN_NAME)
            });
        }
    }
    return rows.map((r) => ({
        name: r.name,
        dbType: r.type,
        ormType: normalizeDbType(label, r.type),
        nullable: r.nullable,
        isPrimary: r.pk
    }));
}
async function listAllTables(provider, label, schema) {
    if (label === 'sqlite') {
        const rows = await provider.executeQuery("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
        return rows.map((r) => r.name);
    }
    if (label === 'postgresql') {
        const sch = schema || 'public';
        const rows = await provider.executeQuery('SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename', [sch]);
        return rows.map((r) => r.tablename);
    }
    if (label === 'mysql') {
        const rows = await provider.executeQuery('SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = DATABASE() AND TABLE_TYPE = "BASE TABLE" ORDER BY TABLE_NAME');
        return rows.map((r) => r.TABLE_NAME);
    }
    const sch = schema || 'dbo';
    const rows = await provider.executeQuery('SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = @p1 AND TABLE_TYPE = "BASE TABLE" ORDER BY TABLE_NAME', [sch]);
    return rows.map((r) => r.TABLE_NAME);
}
async function main() {
    const [, , cmd, arg1, _arg2] = process.argv;
    const argv = process.argv.slice(2);
    // Handle project initialization without requiring a DB connection
    if (cmd === 'init') {
        const dest = path.resolve(process.cwd(), arg1 || '.');
        if (arg1)
            ensureDir(dest);
        const withMigration = process.argv.includes('--with-migration');
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
        if (withMigration) {
            const name = 'Initial';
            const ts = new Date()
                .toISOString()
                .replace(/[-:TZ.]/g, '')
                .slice(0, 14);
            const migDir = path.join(dest, 'migrations');
            ensureDir(migDir);
            const migFile = path.join(migDir, `${ts}_${name}.ts`);
            const template = `import { Migration } from '@ts-linq/core';\n\nexport class ${name} extends Migration {\n  protected get name() { return '${name}'; }\n  protected get version() { return '${ts}'; }\n  public async up(): Promise<void> {\n    // TODO: write your DDL here\n  }\n  public async down(): Promise<void> {\n    // TODO: write your rollback here\n  }\n}\n`;
            writeFileIfMissing(migFile, template);
            console.log(`Created ${migFile}`);
        }
        console.log(`Initialized ts-linq project at ${dest}`);
        console.log('Next steps:');
        console.log('  1) cp .env.example .env  # и заполнить подключение к БД');
        console.log('  2) npx ts-linq schema:export  # создать snapshot');
        console.log('  3) npx ts-linq generate Initial  # создать пустую миграцию (опционально)');
        console.log('  4) npx ts-linq schema:apply    # применить схему');
        return;
    }
    const provider = createProviderFromEnv();
    await provider.connect();
    const gen = new core_2.DiffMigrationGenerator(provider);
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
        const getFlag = (flag) => {
            const long = `--${flag}`;
            for (let i = 0; i < argv.length; i++) {
                const a = argv[i];
                if (a === long) {
                    const next = argv[i + 1];
                    if (next && !next.startsWith('--'))
                        return next;
                    return true;
                }
                if (a.startsWith(`${long}=`))
                    return a.slice(long.length + 1);
            }
            return undefined;
        };
        const toPascalCase = (s) => s
            .replace(/[-_\s]+/g, ' ')
            .split(' ')
            .filter(Boolean)
            .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
            .join('');
        // Subcommand: entity
        if (arg1 === 'entity') {
            const rawName = (argv[2] || '').trim();
            if (!rawName) {
                console.error('Usage: ts-linq generate entity <Name> [--table users] [--dir src/entities]');
                process.exitCode = 2;
                return;
            }
            const entityName = toPascalCase(rawName);
            const outDir = getFlag('dir') || path.join('src', 'entities');
            const table = getFlag('table') || `${entityName.toLowerCase()}s`;
            const fromTable = getFlag('from-table') || undefined;
            const schema = getFlag('schema') || undefined;
            const destDir = path.resolve(process.cwd(), outDir);
            ensureDir(destDir);
            const destFile = path.join(destDir, `${entityName}.ts`);
            let tpl;
            if (fromTable) {
                const label = resolveDialect(provider.providerLabel);
                const defs = await inspectTable(provider, label, fromTable, schema);
                const lines = [];
                lines.push(`import { Entity, Column, PrimaryKey } from '@ts-linq/core';`);
                lines.push('');
                lines.push(`@Entity('${fromTable}')`);
                lines.push(`export class ${entityName} {`);
                for (const col of defs) {
                    const tsType = tsTypeForOrm(col.ormType) + (col.nullable ? ' | null' : '');
                    const opts = [];
                    opts.push(`type: '${col.ormType}'`);
                    if (!col.nullable)
                        opts.push('nullable: false');
                    const deco = col.isPrimary ? 'PrimaryKey' : 'Column';
                    lines.push(`  @${deco}({ ${opts.join(', ')} })`);
                    lines.push(`  public ${col.name}!: ${tsType};`);
                    lines.push('');
                }
                lines.push('}');
                tpl = lines.join('\n');
            }
            else {
                tpl = `import { Entity, Column, PrimaryKey } from '@ts-linq/core';\n\n@Entity('${table}')\nexport class ${entityName} {\n  @PrimaryKey()\n  public id!: number;\n\n  @Column()\n  public name!: string;\n\n  @Column()\n  public createdAt!: Date;\n}\n`;
            }
            if (fs.existsSync(destFile)) {
                console.error(`Entity already exists: ${destFile}`);
                process.exitCode = 2;
                return;
            }
            fs.writeFileSync(destFile, tpl, 'utf8');
            console.log(`Created entity ${entityName} at ${destFile}`);
            return;
        }
        else if (arg1 === 'entities') {
            // Bulk reverse-engineering: generate entities for all tables in schema
            const outDir = getFlag('dir') || path.join('src', 'entities');
            const schema = getFlag('schema') || undefined;
            const label = resolveDialect(provider.providerLabel);
            const destDir = path.resolve(process.cwd(), outDir);
            ensureDir(destDir);
            const tables = await listAllTables(provider, label, schema);
            if (tables.length === 0) {
                console.log('No tables found to generate entities.');
                return;
            }
            for (const tbl of tables) {
                // eslint-disable-next-line no-await-in-loop
                const cols = await inspectTable(provider, label, tbl, schema);
                const entityName = tbl
                    .replace(/[^a-zA-Z0-9_]/g, ' ')
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                    .join('');
                const destFile = path.join(destDir, `${entityName}.ts`);
                if (fs.existsSync(destFile)) {
                    // Skip existing
                    // eslint-disable-next-line no-continue
                    continue;
                }
                const lines = [];
                lines.push(`import { Entity, Column, PrimaryKey } from '@ts-linq/core';`);
                lines.push('');
                lines.push(`@Entity('${tbl}')`);
                lines.push(`export class ${entityName} {`);
                for (const col of cols) {
                    const tsType = tsTypeForOrm(col.ormType) + (col.nullable ? ' | null' : '');
                    const opts = [];
                    opts.push(`type: '${col.ormType}'`);
                    if (!col.nullable)
                        opts.push('nullable: false');
                    const deco = col.isPrimary ? 'PrimaryKey' : 'Column';
                    lines.push(`  @${deco}({ ${opts.join(', ')} })`);
                    lines.push(`  public ${col.name}!: ${tsType};`);
                    lines.push('');
                }
                lines.push('}');
                const tpl = lines.join('\n');
                fs.writeFileSync(destFile, tpl, 'utf8');
                console.log(`Created entity ${entityName} for table '${tbl}' at ${destFile}`);
            }
            return;
        }
        // Default: migration
        const name = (argv[1] && argv[0] !== 'entity' ? argv[1] : argv[0] || 'Migration').replace(/\s+/g, '_');
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
        const snapshot = new core_2.SchemaSnapshotBuilder().buildExpectedFromMetadata();
        const json = new core_2.SchemaSnapshotSerializer().serialize(snapshot);
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
            const target = new core_2.SchemaSnapshotSerializer().deserialize(fs.readFileSync(file, 'utf8'));
            const actual = await new core_2.SchemaSnapshotBuilder(provider).buildActualFromProvider(target);
            const diff = (0, core_2.compareSchemas)(target, actual);
            const dialect = resolveDialect(provider.providerLabel);
            const rendered = (0, core_2.generateMigrationFromDiff)(diff, dialect);
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
            const target = new core_2.SchemaSnapshotSerializer().deserialize(fs.readFileSync(file, 'utf8'));
            const actual = await new core_2.SchemaSnapshotBuilder(provider).buildActualFromProvider(target);
            const diff = (0, core_2.compareSchemas)(target, actual);
            const dialect = resolveDialect(provider.providerLabel);
            const rendered = (0, core_2.generateMigrationFromDiff)(diff, dialect);
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
            const target = new core_2.SchemaSnapshotSerializer().deserialize(fs.readFileSync(file, 'utf8'));
            const actual = await new core_2.SchemaSnapshotBuilder(provider).buildActualFromProvider(target);
            const diff = (0, core_2.compareSchemas)(target, actual);
            const rendered = (0, core_2.generateMigrationFromDiff)(diff, resolveDialect(provider.providerLabel));
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
    else if (cmd === 'migration' || cmd === 'migrations') {
        const sub = arg1 || 'status';
        const cfg = (tryLoadConfig(process.cwd()) || {});
        const migrationsDir = path.resolve(process.cwd(), cfg.migrations || 'migrations');
        const listLocalMigrations = () => {
            if (!fs.existsSync(migrationsDir))
                return [];
            const files = fs.readdirSync(migrationsDir);
            const res = [];
            for (const f of files) {
                const m = /^(\d{14})_(.+)\.(?:ts|js|cjs|mjs)$/.exec(f);
                if (m)
                    res.push({ version: m[1], name: m[2], file: path.join(migrationsDir, f) });
            }
            res.sort((a, b) => a.version.localeCompare(b.version));
            return res;
        };
        const printStatus = async () => {
            await provider.connect();
            const runner = new core_1.MigrationRunner(provider);
            const applied = await runner.getAppliedMigrations();
            const local = listLocalMigrations();
            const appliedSet = new Set(applied.map((a) => a.version));
            const pending = local.filter((l) => !appliedSet.has(l.version));
            console.log(`Migrations directory: ${migrationsDir}`);
            console.log(`Applied: ${applied.length}`);
            for (const a of applied)
                console.log(`  ${a.version}  ${a.name}`);
            console.log(`Pending: ${pending.length}`);
            for (const p of pending)
                console.log(`  ${p.version}  ${p.name}`);
            await provider.disconnect();
        };
        const dryRun = async () => {
            // Alias to schema:diff
            const file = argv[2] || path.resolve(process.cwd(), 'schema.snapshot.json');
            if (!fs.existsSync(file)) {
                console.error(`Snapshot file not found: ${file}`);
                process.exitCode = 2;
                return;
            }
            const target = new core_2.SchemaSnapshotSerializer().deserialize(fs.readFileSync(file, 'utf8'));
            const actual = await new core_2.SchemaSnapshotBuilder(provider).buildActualFromProvider(target);
            const diff = (0, core_2.compareSchemas)(target, actual);
            const rendered = (0, core_2.generateMigrationFromDiff)(diff, resolveDialect(provider.providerLabel));
            for (const sql of rendered.up)
                console.log(sql);
        };
        if (sub === 'status') {
            await printStatus();
        }
        else if (sub === 'dry-run') {
            await dryRun();
        }
        else if (sub === 'rollback') {
            console.error('Rollback requires executable migration files with down() methods. Support will be added in a follow-up.');
            process.exitCode = 2;
        }
        else {
            console.error('Usage: ts-linq migration <status|dry-run|rollback> [args]  (see docs for details)');
            process.exitCode = 2;
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