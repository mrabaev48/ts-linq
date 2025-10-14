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
exports.InitCommand = void 0;
const path = __importStar(require("path"));
const utils_1 = require("../utils");
class InitCommand {
    constructor() {
        this.name = 'init';
        this.describe = 'Initialize a project with ts-linq skeleton';
    }
    run(argv) {
        const destArg = argv[1];
        const dest = path.resolve(process.cwd(), destArg || '.');
        if (destArg)
            (0, utils_1.ensureDir)(dest);
        const withMigration = argv.includes('--with-migration');
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
    "paths": { "@src/*": ["src/*"] }
  },
  "include": ["src/**/*", "migrations/**/*"],
  "exclude": ["node_modules", "dist"]
}
`;
        const configTs = `export default {
  provider: process.env.DB_PROVIDER || 'sqlite',
  connection: process.env.DATABASE_URL || process.env.SQLITE_URL || 'file:app.db',
  migrations: './migrations',
  entities: './src/entities'
};
`;
        const userEntity = `import { Entity, Column, PrimaryKey } from '@ts-linq/core';

@Entity('users')
export class User {
  @PrimaryKey()
  public id!: number;

  @Column()
  public name!: string;
}
`;
        const dbContext = `import 'reflect-metadata';
import { DbContext } from '@ts-linq/core';
import { SQLiteProvider } from '@ts-linq/sqlite';

export class AppDbContext extends DbContext {
  public constructor() {
    super({ provider: new SQLiteProvider(process.env.SQLITE_URL || 'file:app.db') });
  }
}
`;
        const envExample = `# Database provider: sqlite | postgresql | mysql | mssql
DB_PROVIDER=sqlite
SQLITE_URL=file:app.db
# POSTGRES_URL=postgres://user:pass@localhost:5432/db
# MYSQL_URL=mysql://user:pass@localhost:3306/db
# MSSQL_URL=mssql://user:pass@localhost:1433/db
`;
        (0, utils_1.writeFileIfMissing)(path.join(dest, 'tsconfig.json'), tsconfig);
        (0, utils_1.writeFileIfMissing)(path.join(dest, 'ts-linq.config.ts'), configTs);
        (0, utils_1.writeFileIfMissing)(path.join(dest, '.env.example'), envExample);
        (0, utils_1.writeFileIfMissing)(path.join(dest, 'src', 'entities', 'User.ts'), userEntity);
        (0, utils_1.writeFileIfMissing)(path.join(dest, 'src', 'context', 'AppDbContext.ts'), dbContext);
        (0, utils_1.ensureDir)(path.join(dest, 'migrations'));
        (0, utils_1.writeFileIfMissing)(path.join(dest, 'migrations', '.gitkeep'), '');
        if (withMigration) {
            const name = 'Initial';
            const ts = new Date()
                .toISOString()
                .replace(/[-:TZ.]/g, '')
                .slice(0, 14);
            const migDir = path.join(dest, 'migrations');
            (0, utils_1.ensureDir)(migDir);
            const migFile = path.join(migDir, `${ts}_${name}.ts`);
            const template = `import { Migration } from '@ts-linq/core';

export class ${name} extends Migration {
  protected get name() { return '${name}'; }
  protected get version() { return '${ts}'; }
  public async up(): Promise<void> { }
  public async down(): Promise<void> { }
}
`;
            (0, utils_1.writeFileIfMissing)(migFile, template);
            console.log(`Created ${migFile}`);
        }
        console.log(`Initialized ts-linq project at ${dest}`);
        return Promise.resolve();
    }
}
exports.InitCommand = InitCommand;
//# sourceMappingURL=InitCommand.js.map